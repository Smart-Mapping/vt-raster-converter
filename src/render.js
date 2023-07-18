// This module is derived from https://github.com/consbio/mbgl-renderer

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const zlib = require('zlib');
const mbgl = require('@maplibre/maplibre-gl-native');
const MBTiles = require('@mapbox/mbtiles');

const logger = require('./logger');
const config = require('./config/config.json');

/**
 * Splits out mbtiles name from the URL
 *
 * @param {string} url - URL to resolve
 */
const resolveNamefromURL = (url) => url.split('://')[1].split('/')[0];

/**
 * Resolve a URL of a local mbtiles file to a file path
 * Expected to follow this format "mbtiles://<mbtiles_file>"
 *
 * @param {string} tilePath - path containing mbtiles files
 * @param {string} url - url of a data source in style.json file
 */
const resolveMBTilesURL = (tilePath, url) => {
    const mbTilesURL = path.format({
        dir: tilePath,
        name: resolveNamefromURL(url),
        ext: '.mbtiles',
    });

    logger.debug('Resolved MBTiles URL: ' + mbTilesURL);
    return mbTilesURL;
};

/**
 * Given a URL to a local mbtiles file, get the TileJSON for that to load correct tiles.
 *
 * @param {string} tilePath - path containing mbtiles files
 * @param {string} url - url of a data source in style.json file
 * @param {function} callback - function to call with (err, {data})
 */
const getLocalTileJSON = (tilePath, url, callback) => {
    const mbtilesFilename = resolveMBTilesURL(tilePath, url);
    const service = resolveNamefromURL(url);

    new MBTiles(mbtilesFilename, (err, mbtiles) => {
        if (err) {
            callback(err);
            return null;
        }

        mbtiles.getInfo((infoErr, info) => {
            if (infoErr) {
                callback(infoErr);
                return null;
            }

            const { minzoom, maxzoom, center, bounds, format } = info;

            const ext = format === 'pbf' ? '.pbf' : '';

            const tileJSON = {
                tilejson: '1.0.0',
                tiles: [`mbtiles://${service}/{z}/{x}/{y}${ext}`],
                minzoom,
                maxzoom,
                center,
                bounds,
            };

            callback(null, { data: Buffer.from(JSON.stringify(tileJSON)) });
            return null;
        });

        return null;
    });
};

/**
 * Fetch a tile from a local mbtiles file.
 *
 * @param {string} tilePath - path containing mbtiles files
 * @param {string} url - url of a data source in style.json file
 * @param {function} callback - function to call with (err, {data})
 */
const getLocalTile = (tilePath, url, callback) => {
    const matches = url.match(RegExp('mbtiles://([^/]+)/(\\d+)/(\\d+)/(\\d+)'));
    const [z, x, y] = matches.slice(matches.length - 3, matches.length);
    const isVector = path.extname(url) === '.pbf';
    const mbtilesFile = resolveMBTilesURL(tilePath, url);


    new MBTiles(mbtilesFile, (err, mbtiles) => {
        if (err) {
            callback(err);
            return null;
        }

        mbtiles.getTile(z, x, y, (tileErr, data) => {
            if (tileErr) {
                logger.warn(`tile not found: z:${z} x:${x} y:${y} from ${mbtilesFile}\n${tileErr}`);
                callback(null, {});
                return null;
            }

            if (isVector) {
                // if the tile is compressed, unzip it (for vector tiles only!)
                zlib.unzip(data, (unzipErr, unzippedData) => {
                    callback(unzipErr, { data: unzippedData });
                });
            } else {
                callback(null, { data });
            }

            return null;
        });

        return null;
    });
};

/**
 * Read asset (glyphs, sprites) from local files.
 * @param {string} url path to local file
 * @param {function} callback callback function
 */
const getLocalAsset = (url, callback) => {
    logger.debug(`Get local asset: ${url}`);
    fs.readFile(url, function (err, data) {
        callback(err, { data: data });
    });
};

/**
 * Constructs a request handler for the map to load resources.
 * @param {*} tilePath - path containing mbtiles files
 * @returns requestHandler object
 */
const requestHandler =
    (dataPath) =>
        ({ url, kind }, callback) => {
            logger.debug(`Map request (kind ${kind}): ${url}`);
            try {
                switch (kind) {
                    case 1: {
                        // style
                        break;
                    }
                    case 2: {
                        // source
                        getLocalTileJSON(path.join(dataPath + '/tiles'), url, callback);
                        break;
                    }
                    case 3: {
                        // tile
                        getLocalTile(path.join(dataPath + '/tiles'), url, callback);
                        break;
                    }
                    case 4: {
                        // glyph
                        let rUrl = path.join(dataPath, '/fonts', url);
                        rUrl = rUrl.replace(/%20/g, ' ');
                        getLocalAsset(rUrl, callback);
                        break;
                    }
                    case 5: {
                        // sprite image
                        const rUrl = path.join(dataPath, '/sprites', url);
                        getLocalAsset(rUrl, callback);
                        break;
                    }
                    case 6: {
                        // sprite json
                        const rUrl = path.join(dataPath, '/sprites', url);
                        getLocalAsset(rUrl, callback);
                        break;
                    }
                    case 7: {
                        // image source
                        break;
                    }
                    default: {
                        // NOT HANDLED!
                        logger.error(`Request kind not handled: ${kind}`);
                    }
                }
            } catch (err) {
                logger.error(`Error while making resource request to: ${url}\n${err}`);
                callback(err);
            }
        };

/**
 * Convert premultiplied image buffer from MapLibre GL to RGBA PNG format.
 * @param {Uint8Array} imgBuffer - image data buffer
 * @param {number} width - image width
 * @param {number} height - image height
 * @param {number} ratio - image pixel ratio
 * @param {number} bufferWidth - buffer for map width
 * @param {number} bufferHeight - buffer for map height
 * @param {number} resizeFactor - factor to reduce the size of the image (used for zoom level 0)
 * @returns
 */
const toPNG = async (imgBuffer, width, height, ratio, bufferWidth, bufferHeight, resizeFactor) => {
    // Un-premultiply pixel values
    // Mapbox GL buffer contains premultiplied values, which are not handled correctly by sharp
    // https://github.com/mapbox/mapbox-gl-native/issues/9124
    // since we are dealing with 8-bit RGBA values, normalize alpha onto 0-255 scale and divide
    // it out of RGB values

    logger.debug('Convert image buffer to png');

    for (let i = 0; i < imgBuffer.length; i += 4) {
        const alpha = imgBuffer[i + 3];
        const norm = alpha / 255;
        if (alpha === 0) {
            imgBuffer[i] = 0;
            imgBuffer[i + 1] = 0;
            imgBuffer[i + 2] = 0;
        } else {
            imgBuffer[i] /= norm;
            imgBuffer[i + 1] = imgBuffer[i + 1] / norm;
            imgBuffer[i + 2] = imgBuffer[i + 2] / norm;
        }
    }

    const tileImage = sharp(imgBuffer, {
        raw: {
            width: width * ratio,
            height: height * ratio,
            channels: 4,
        },
    });

    // Remove buffer
    if (bufferWidth > 0 || bufferHeight > 0) {
        logger.debug(`Extract image from buffer with width ${width * ratio - (bufferWidth * ratio * 2)} and height ${height * ratio - (bufferHeight * ratio * 2)}`);
        tileImage.extract({ width: width * ratio - (bufferWidth * ratio * 2), height: height * ratio - (bufferHeight * ratio * 2), left: bufferWidth * ratio, top: bufferHeight * ratio });
    }

    // Resize image (for zoom 0)
    if (resizeFactor != 1) {
        logger.debug(`Resize image to width ${width * ratio * resizeFactor} and height ${height * ratio * resizeFactor}`);
        tileImage.resize(width * ratio * resizeFactor, height * ratio * resizeFactor);
    }

    return tileImage.png().toBuffer();
};

/**
 * Asynchronously render a map using MapLibre GL, based on layers specified in style.
 * Returns PNG image data (via async / Promise).
 *
 * @param {object} style - MapLibre GL style object
 * @param {object} center - Array with coordinates [lon, lat] for map center
 * @param {number} zoom - zoom level of output map
 * @param {number} width - width of output map
 * @param {number} height - height of output map
 * @param {number} bufferWidth - buffer for map width
 * @param {number} bufferHeight - buffer for map height 
 * @param {number} ratio - ratio for output map
 * @param {string} dataPath - path to data directory
 */
const renderImage = async (style, center, zoom, width, height, bufferWidth, bufferHeight, ratio = 1, dataPath) => {

    if (!style) {
        throw new Error('Style is a required parameter');
    }

    if (center !== null) {
        if (center.length !== 2) {
            throw new Error(
                `Center must be longitude,latitude. Invalid value found: ${[
                    ...center,
                ]}`
            );
        }

        if (Math.abs(center[0]) > 180) {
            throw new Error(
                `Center longitude is outside world bounds (-180 to 180 deg): ${center[0]}`
            );
        }

        if (Math.abs(center[1]) > 90) {
            throw new Error(
                `Center latitude is outside world bounds (-90 to 90 deg): ${center[1]}`
            );
        }
    } else {
        throw new Error('Center is a required parameter');
    }

    let resizeFactor = 1;

    if (zoom !== null) {
        if (zoom < 0 || zoom > 24) {
            throw new Error(`Zoom level is outside supported range (0-24): ${zoom}`);
        } else if (zoom == 0) {
            // For raster zoom 0 create image with double size in raster zoom 1 and resize it.
            logger.debug('Raster zoom 0 -> generating double sized image with zoom 1');
            width = width * 2;
            height = height * 2;
            resizeFactor = 0.5;
        } else if (zoom > -1) {
            // Create buffer only for zoom > 1, since buffering is not necessary/possible for zoom 0 and 1
            height = height + (bufferHeight * 2);
            width = width + (bufferWidth * 2);
        }
    } else {
        throw new Error('Zoom is a required parameter');
    }

    // Vector zoom 0 is equivalent to raster zoom 1, therefore reduce zoom level for vector rendering.
    zoom = Math.max(zoom - 1, 0);

    logger.info('Render map with center: ' + center);
    logger.info('Render map with zoom: ' + zoom);
    logger.info(`Render map with buffered width ${width}px and height ${height}px`);
    logger.info('Render map with resize factor: ' + resizeFactor);
    logger.info('Render map with ratio: ' + ratio);

    const map = new mbgl.Map({
        request: requestHandler(dataPath),
        ratio,
    });
    logger.debug('Load map with style: ' + config.styles[style].file);
    map.load(require(path.join(dataPath, '/styles', config.styles[style].file)));


    const imgBuffer = await renderMap(map, {
        zoom,
        center,
        height,
        width,
        bearing: 0,
        pitch: 0,
    });

    return toPNG(imgBuffer, width, height, ratio, bufferWidth, bufferHeight, resizeFactor);
};

/**
 * Render MapLibre GL map
 * @param {object} map - MapLibre GL map
 * @param {*} options - render options for map
 * @returns map image
 */
const renderMap = (map, options) => {
    logger.debug('render map');
    return new Promise((resolve, reject) => {
        map.render(options, (err, buffer) => {
            if (err) {
                return reject(err);
            }
            map.release();
            return resolve(buffer);
        });
    });
};

module.exports = { renderImage, resolveNamefromURL, resolveMBTilesURL };