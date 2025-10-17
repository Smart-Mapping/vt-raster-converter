// This module is derived from https://github.com/consbio/mbgl-renderer

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const zlib = require('zlib');
const mbgl = require('@maplibre/maplibre-gl-native');
const MBTiles = require('@mapbox/mbtiles');
const { PMTiles } = require('pmtiles');
const axios = require('axios');

const logger = require('./logger');
const config = require('./config/config.json');

const isMBTilesURL = (url) => url.startsWith('mbtiles://');
const isPMTilesURL = (url) => url.startsWith('pmtiles://');
const isRemotePMTilesURL = (url) => url.startsWith(`pmtiles://https://`)

// Cache for PMTiles instances to avoid reopening files
const pmtilesCache = new Map();
const remotePmtilesCache = new Map();

/**
 * Splits out tile archive name from the URL
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
 * Resolve a URL of a local pmtiles file to a file path
 * Expected to follow this format "pmtiles://<pmtiles_file>"
 *
 * @param {string} tilePath - path containing pmtiles files
 * @param {string} url - url of a data source in style.json file
 */
const resolvePMTilesURL = (tilePath, url) => {
    const pmTilesURL = path.format({
        dir: tilePath,
        name: resolveNamefromURL(url),
        ext: '.pmtiles',
    });

    logger.debug('Resolved PMTiles URL: ' + pmTilesURL);
    return pmTilesURL;
};

/**
 * Get or create a PMTiles instance from cache
 * For local files, we need to provide a custom source
 *
 * @param {string} filepath - path to pmtiles file
 */
const getPMTilesInstance = async (filepath) => {
    if (!pmtilesCache.has(filepath)) {
        logger.debug(`Creating new PMTiles instance for: ${filepath}`);

        // Create a custom source for reading local files
        const source = {
            getKey: () => filepath,
            getBytes: async (offset, length) => {
                const fd = await fs.promises.open(filepath, 'r');
                try {
                    const buffer = Buffer.alloc(length);
                    const { bytesRead } = await fd.read(buffer, 0, length, offset);
                    
                    // Convert Node.js Buffer to ArrayBuffer
                    const arrayBuffer = buffer.buffer.slice(
                        buffer.byteOffset,
                        buffer.byteOffset + bytesRead
                    );
                    
                    return {
                        data: arrayBuffer,
                        etag: undefined,
                        cacheControl: undefined,
                        expires: undefined
                    };
                } finally {
                    await fd.close();
                }
            }
        };

        const pmtiles = new PMTiles(source);

        pmtilesCache.set(filepath, pmtiles);
    }
    return pmtilesCache.get(filepath);
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
 * Given a URL to a local pmtiles file, get the TileJSON for that to load correct tiles.
 *
 * @param {string} tilePath - path containing pmtiles files
 * @param {string} url - url of a data source in style.json file
 * @param {function} callback - function to call with (err, {data})
 */
const getLocalPMTileJSON = async (tilePath, url, callback) => {
    try {
        const pmtilesFilename = resolvePMTilesURL(tilePath, url);
        const service = resolveNamefromURL(url);
        
        const pmtiles = await getPMTilesInstance(pmtilesFilename);
        const header = await pmtiles.getHeader();
        const metadata = await pmtiles.getMetadata();
        
        // Determine tile format from header
        const tileType = header.tileType;
        let ext = '';
        
        // tileType: 1 = MVT (Mapbox Vector Tile), 2 = PNG, 3 = JPEG, 4 = WEBP
        if (tileType === 1) {
            ext = '.mvt';
        } else {
            throw new Error('PMTiles file contains unsupported tileType for rendering!');
        }

        const tileJSON = {
            tilejson: '1.0.0',
            tiles: [`pmtiles://${service}/{z}/{x}/{y}${ext}`],
            minzoom: header.minZoom || 0,
            maxzoom: header.maxZoom || 14,
            center: metadata.center || [0, 0],
            bounds: metadata.bounds || [-180, -85.0511, 180, 85.0511],
        };

        callback(null, { data: Buffer.from(JSON.stringify(tileJSON)) });
    } catch (err) {
        logger.error(`Error creating TileJSON for PMTiles file: ${err}`);
        callback(err);
    }
};

/**
 * Given a URL to a remote pmtiles file, get the TileJSON for that to load correct tiles.
 *
 * @param {string} url - url of a data source in style.json file (format: 'pmtiles://https://...')
 * @param {function} callback - function to call with (err, {data})
 */
const getRemotePMTileJSON = async (url, callback) => {
    logger.debug("Preparing remote PMTile TileJSON with ${url}")
    try {
        // Extract the remote HTTPS URL from the pmtiles:// prefix
        if (!url.startsWith('pmtiles://')) {
            throw new Error('URL must start with pmtiles://');
        }
        
        const remoteUrl = url.substring('pmtiles://'.length);
        
        // Validate it's an HTTP(S) URL
        if (!remoteUrl.startsWith('http://') && !remoteUrl.startsWith('https://')) {
            throw new Error('Remote URL must be an HTTP or HTTPS URL');
        }
        
        // Create PMTiles instance with the remote URL
        // PMTiles constructor accepts a URL string directly and creates FetchSource
        const pmtiles = new PMTiles(remoteUrl);
        const header = await pmtiles.getHeader();
        const metadata = await pmtiles.getMetadata();

        // Determine tile format from header
        const tileType = header.tileType;
        let ext = '';

        // tileType: 1 = MVT (Mapbox Vector Tile), 2 = PNG, 3 = JPEG, 4 = WEBP
        if (tileType === 1) {
            ext = '.mvt';
        } else {
            throw new Error('PMTiles file contains unsupported tileType for rendering!');
        }
        
        const tileJSON = {
            tilejson: '1.0.0',
            tiles: [`${url}/{z}/{x}/{y}${ext}`],
            minzoom: header.minZoom || 0,
            maxzoom: header.maxZoom || 14,
            center: metadata.center || [0, 0],
            bounds: metadata.bounds || [-180, -85.0511, 180, 85.0511],
        };
        
        callback(null, { data: Buffer.from(JSON.stringify(tileJSON)) });
    } catch (err) {
        logger.error(`Error creating TileJSON for remote PMTiles file: ${err}`);
        callback(err);
    }
};

/**
 * Given a URL template to a remote tile server, get the TileJSON for that to load correct tiles.
 *
 * @param {string} url - url template of a tile server (format: 'https://tileserver.com/tiles/{z}/{x}/{y}.mvt')
 * @param {function} callback - function to call with (err, {data})
 */
const getRemoteTileJSON = async (url, callback) => {
    logger.debug(`Preparing remote tile server TileJSON with ${url}`);
    try {
        // Validate it's an HTTP(S) URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            throw new Error('Remote URL must be an HTTP or HTTPS URL');
        }
        
        // Check if URL contains tile template placeholders
        if (!url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}')) {
            throw new Error('URL must contain {z}, {x}, and {y} placeholders');
        }
        
        // Determine tile format from URL extension
        const ext = path.extname(url.split('{')[0]); // Get extension before placeholders
        let format = 'pbf'; // default for vector tiles
        
        if (url.includes('.mvt') || url.includes('.pbf')) {
            format = 'pbf';
        } else {
            throw new Error('Only tileservers delivering vector tiles are supported');
        }       
        // Create TileJSON with default values for remote tile servers
        // Note: Without accessing the tile server's metadata endpoint,
        // we use sensible defaults
        const tileJSON = {
            tilejson: '2.2.0',
            tiles: [url],
            minzoom: 0,
            maxzoom: 14,
            bounds: [-180, -85.0511, 180, 85.0511],
            center: [0, 0, 2],
            format: format,
        };
        
        // // Optionally, try to fetch TileJSON from the server if it exists
        // // Many tile servers provide a TileJSON endpoint
        try {
            const baseUrl = url.split('/{z}')[0]; // Get base URL before tile template
            const tileJsonUrl = `${baseUrl}.json`;
            
            const response = await fetch(tileJsonUrl);
            if (response.ok) {
                const remoteTileJSON = await response.json();
                logger.debug(`Retrieved TileJSON from ${tileJsonUrl}`);
                callback(null, { data: Buffer.from(JSON.stringify(remoteTileJSON)) });
                return;
            }
        } catch (fetchErr) {
            logger.debug(`No TileJSON endpoint found, using defaults: ${fetchErr.message}`);
        }
        
        callback(null, { data: Buffer.from(JSON.stringify(tileJSON)) });
    } catch (err) {
        logger.error(`Error creating TileJSON for remote tile server: ${err}`);
        callback(err);
    }
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
 * Fetch a tile from a local pmtiles file.
 *
 * @param {string} tilePath - path containing pmtiles files
 * @param {string} url - url of a data source in style.json file
 * @param {function} callback - function to call with (err, {data})
 */
const getLocalPMTile = async (tilePath, url, callback) => {
    try {
        const matches = url.match(RegExp('pmtiles://([^/]+)/(\\d+)/(\\d+)/(\\d+)'));
        if (!matches) {
            throw new Error(`Invalid PMTiles URL format: ${url}`);
        }

        const [z, x, y] = matches.slice(matches.length - 3, matches.length).map(Number);
        const isVector = path.extname(url) === '.mvt';
        const pmtilesFile = resolvePMTilesURL(tilePath, url);

        const pmtiles = await getPMTilesInstance(pmtilesFile);
        
        const tileData = await pmtiles.getZxy(z, x, y);

        if (!tileData || !tileData.data) {
            logger.warn(`tile not found: z:${z} x:${x} y:${y} from ${pmtilesFile}`);
            callback(null, {});
            return;
        }

        // PMTiles tiles are already in the correct format
        // Vector tiles in PMTiles are typically gzip compressed
        if (isVector) {
            // Check if data needs decompression
            zlib.gunzip(Buffer.from(tileData.data), (unzipErr, unzippedData) => {
                if (unzipErr) {
                    // If gunzip fails, the data might already be uncompressed
                    logger.debug(`Tile appears to be uncompressed, using as-is`);
                    callback(null, { data: Buffer.from(tileData.data) });
                } else {
                    callback(null, { data: unzippedData });
                }
            });
        } else {
            callback(null, { data: Buffer.from(tileData.data) });
        }
    } catch (err) {
        logger.error(`Error fetching PMTile: ${err}`);
        callback(err);
    }
};

/**
 * Get or create a cached PMTiles instance for a remote URL
 */
const getRemotePMTilesInstance = async (remoteUrl) => {
    if (!remotePmtilesCache.has(remoteUrl)) {
        logger.debug(`Creating new remote PMTiles instance for: ${remoteUrl}`);
        const pmtiles = new PMTiles(remoteUrl);
        remotePmtilesCache.set(remoteUrl, pmtiles);
    }
    return remotePmtilesCache.get(remoteUrl);
};

/**
 * Fetch a tile from a remote pmtiles file on S3.
 *
 * @param {string} url - url of a tile request (format: 'pmtiles://https://.../map.pmtiles/{z}/{x}/{y}.mvt')
 * @param {function} callback - function to call with (err, {data})
 */
const getRemotePMTile = async (url, callback) => {
    try {
        const matches = url.match(/^pmtiles:\/\/(https?:\/\/.+?)\/(\d+)\/(\d+)\/(\d+)/);
        if (!matches) {
            throw new Error(`Invalid PMTiles URL format: ${url}`);
        }
        
        const remoteUrl = matches[1]; 
        const z = Number(matches[2]);
        const x = Number(matches[3]);
        const y = Number(matches[4]);
        const isVector = path.extname(url) === '.mvt';
        
        // Get cached PMTiles instance
        const pmtiles = await getRemotePMTilesInstance(remoteUrl);
        
        const tileData = await pmtiles.getZxy(z, x, y);
        if (!tileData || !tileData.data) {
            logger.warn(`tile not found: z:${z} x:${x} y:${y} from ${remoteUrl}`);
            callback(null, {});
            return;
        }
        
        // PMTiles tiles are already in the correct format
        // Vector tiles in PMTiles are typically gzip compressed
        if (isVector) {
            // Check if data needs decompression
            zlib.gunzip(Buffer.from(tileData.data), (unzipErr, unzippedData) => {
                if (unzipErr) {
                    // If gunzip fails, the data might already be uncompressed
                    logger.debug(`Tile appears to be uncompressed, using as-is`);
                    callback(null, { data: Buffer.from(tileData.data) });
                } else {
                    callback(null, { data: unzippedData });
                }
            });
        } else {
            callback(null, { data: Buffer.from(tileData.data) });
        }
    } catch (err) {
        logger.error(`Error fetching remote PMTile: ${err}`);
        callback(err);
    }
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
 * Fetch a remotely hosted tile.
 * Empty or missing tiles return null data to the callback function, which
 * result in those tiles not rendering but no errors being raised.
 *
 * @param {String} url - URL of the tile
 * @param {function} callback - callback to call with (err, {data})
 */
const getRemoteTile = async (url, callback) => {
    await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer'
    }).then(function (response) {
        switch (response.status) {
        case 200: {
            let data = response.data;
            return callback(null, { data });
        }
        case 204: {
            // No data for this url
            return callback(null, {});
        }
        case 404: {
            // Tile not found
            // this may be valid for some tilesets that have partial coverage
            // on servers that do not return blank tiles in these areas.
            logger.warn(`Missing tile at: ${url}`);
            return callback(null, {});
        }
        default: {
            // assume error
            const msg = `request for remote tile failed: ${url} (status: ${response.statusCode})`;
            logger.error(msg);
            return callback(new Error(msg));
        }
        }
    }).catch(function (err) {
        logger.error(err);
        return callback(err);
    });
};

/**
 * Fetch a remotely hosted asset: glyph, sprite, etc
 * Anything other than a HTTP 200 response results in an exception.
 *
 *
 * @param {String} url - URL of the asset
 * @param {function} callback - callback to call with (err, {data})
 */
const getRemoteAsset = async (url, callback) => {
    await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer'
    }).then(function (response) {
        switch (response.status) {
        case 200: {
            let data = response.data;
            return callback(null, { data });
        }
        default: {
            // assume error
            const msg = `request for remote tile failed: ${url} (status: ${response.statusCode})`;
            logger.error(msg);
            return callback(new Error(msg));
        }
        }
    }).catch(function (err) {
        return callback(err);
    });
    return null;
};

/**
 * Constructs a request handler for the map to load resources.
 * @param {*} dataPath - path to data directory
 * @returns requestHandler object
 */
const requestHandler =
    (dataPath) =>
        ({ url, kind }, callback) => {
            logger.debug(`Map request (kind ${kind}): ${url}`);
            try {
                switch (kind) {
                case 1: {
                    break;
                }
                case 2: {
                    // source
                    if (isMBTilesURL(url)) {
                        logger.info("Local MBTiles TileJSON")
                        getLocalMBTileJSON(path.join(dataPath + '/tiles'), url, callback);
                    } else if (isPMTilesURL(url)) {
                        if (isRemotePMTilesURL(url)) {
                            logger.info("Remote PMTiles TileJSON")
                            getRemotePMTileJSON(url, callback);
                        } else {
                            logger.info("Local PMTiles TileJSON")
                            getLocalPMTileJSON(path.join(dataPath + '/tiles'), url, callback);
                        }
                    } else {
                        logger.info("Remote TileJSON")
                        getRemoteTileJSON(url, callback);
                    }
                    break;
                }
                case 3: {
                    // tile
                    if (isMBTilesURL(url)) {
                        logger.info("Local MBTiles tile")
                        getLocalTile(path.join(dataPath + '/tiles'), url, callback);
                    } else if (isPMTilesURL(url)) {
                        if (isRemotePMTilesURL(url)) {
                            logger.info("Remote PMTiles Tile")
                            getRemotePMTile(url, callback);
                        } else {
                            logger.info("Local PMTiles tile")
                            getLocalPMTile(path.join(dataPath + '/tiles'), url, callback);
                        }
                    } else {
                        logger.info("Remote tile")
                        getRemoteTile(url, callback);
                    }
                    break;
                }
                case 4: {
                    // glyph
                    if (url.search(/http/) == 0) {
                        getRemoteAsset(url, callback);
                    } else {
                        let rUrl = path.join(dataPath, '/fonts', url);
                        rUrl = rUrl.replace(/%20/g, ' ');
                        getLocalAsset(rUrl, callback);
                    }
                    break;
                }
                case 5: {
                    // sprite image
                    if (url.search(/http/) == 0) {
                        getRemoteAsset(url, callback);
                    } else {
                        const rUrl = path.join(dataPath, '/sprites', url);
                        getLocalAsset(rUrl, callback);
                    }
                    break;
                }
                case 6: {
                    // sprite json
                    if (url.search(/http/) == 0) {
                        getRemoteAsset(url, callback);
                    } else {
                        const rUrl = path.join(dataPath, '/sprites', url);
                        getLocalAsset(rUrl, callback);
                    }
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
            channels: 4
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

/**
 * Clear PMTiles cache (useful for cleanup)
 */
const clearPMTilesCache = () => {
    pmtilesCache.clear();
    logger.debug('clearPMTilesCache - PMTiles cache cleared');
};

module.exports = { 
    renderImage, 
    resolveNamefromURL, 
    resolveMBTilesURL, 
    resolvePMTilesURL,
    clearPMTilesCache 
};