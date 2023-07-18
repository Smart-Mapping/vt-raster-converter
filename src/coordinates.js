// Parts of this module are derived from https://github.com/datalyze-solutions/globalmaptiles

const logger = require('./logger');

/**
 * Get center of tile [lon, lat]
 * @param {number} zoom - zoom level
 * @param {number} x - tile column
 * @param {number} y - tile row
 * @param {tileSize} tileSize - tile size in pixel
 */
const getTileCenter = (zoom, x, y, tileSize = 256) => {
    const pxCenterX = x * tileSize + (tileSize / 2);
    const pxCenterY = y * tileSize + (tileSize / 2);
    logger.debug(`Center Pixel: ${pxCenterX}, ${pxCenterY}`);

    const centerMeters = pixelsToMeters(pxCenterX, pxCenterY, zoom);
    logger.debug('Center Meters: ' + centerMeters);

    const center = metersToLatLon(centerMeters[0], centerMeters[1]);
    logger.debug('Center WGS84: ' + center);
    return center;
};

/**
 * Check if tile is at the edge of the grid
 * @param {number} zoom - zoom level
 * @param {number} x - tile column
 * @param {number} y - tile row
 */
const isEdgeTile = (zoom, x, y) => {
    const numTiles = Math.pow(2, zoom);
    let isEdgeTile = { x: false, y: false };

    if (x == 0 || x == numTiles - 1) {
        isEdgeTile.x = true;
    }
    if (y == 0 || y == numTiles - 1) {
        isEdgeTile.y = true;
    }
    logger.debug('Is edge tile: ' + isEdgeTile);

    return isEdgeTile;
};

/**
 * Convert coordinates in meters to lon/lat.
 * @param {number} mx - x coordinate (EPSG:3857)
 * @param {number} my - y coordinate (EPSG:3857)
 * @returns 
 */
const metersToLatLon = (mx, my) => {
    const originShift = Math.PI * 2 * 6378137 / 2.0;
    let lon = mx / originShift * 180.0;
    let lat = my / originShift * 180.0;
    lat =
        180 / Math.PI *
        (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - (Math.PI / 2.0));
    return [lon, lat];
};

/**
 * Convert coordinates from pixel to meters (EPSG:3857).
 * @param {number} px - x coordinate in pixel
 * @param {number} py - y coordinate in pixel
 * @param {number} zoom - zoom level
 * @returns 
 */
const pixelsToMeters = (px, py, zoom) => {
    const originShift = Math.PI * 2 * 6378137 / 2.0;
    var res, mx, my;
    res = Math.PI * 2 * 6378137 / 256 / Math.pow(2, zoom);
    mx = px * res - originShift;
    my = py * res - originShift;
    // Invert y axis 
    return [mx, my * -1];
};

module.exports = { getTileCenter, isEdgeTile, metersToLatLon, pixelsToMeters };