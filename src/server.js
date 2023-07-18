const express = require('express');

const logger = require('./logger');
const { renderImage } = require('./render');
const { getTileCenter, isEdgeTile } = require('./coordinates');
const config = require('./config/config.json');

const server = express();
const port = (!process.env.SERVER_PORT) ? config.server.port : process.env.SERVER_PORT;

server.get('/tiles/:style/:z/:x/:y', (req, res) => {
    logger.info('Request tile: ' + req.params.style + '/' + req.params.z + '/' + req.params.x + '/' + req.params.y);

    if (!process.env.DATA_PATH) {
        logger.error('Environment variable DATA_PATH is not defined');
        res.status(500).send('No data path defined');
    } else {

        let params = null;
        try {
            params = parseParameters(req);
        } catch (err) {
            res.status(400).send(err.message);
        }

        if (params) {
            renderImage(params.style,
                params.center,
                params.zoom,
                params.tileSize,
                params.tileSize,
                params.bufferWidth,
                params.bufferHeight,
                params.ratio,
                process.env.DATA_PATH
            ).then((data, rejected) => {
                if (rejected) {
                    logger.error('Render request rejected', rejected);
                }

                res.type('image/png');
                res.status(200).send(data);
            }).catch((err) => {
                logger.error(err);
                res.status(500).send(err.message);
            });
        }
    }
});

server.get('/ping', (req, res) => {
    res.status(200).send('true');
});

server.listen(port);

/**
 * Parse URL parameters from request
 * @param {Request} req - HTTP request
 * @returns parameter object 
 */
const parseParameters = (req) => {
    let params = {
        style: null,
        center: null,
        zoom: null,
        tileSize: 256,
        bufferWidth: 256,
        bufferHeight: 256,
        ratio: 1
    };

    // style
    if (req.params.style in config.styles) {
        params.style = req.params.style;
    } else {
        logger.error('Invalid style name: ' + req.params.style);
        throw new Error('Invalid style name: ' + req.params.style);
    }

    let x = null;
    let y = null;

    // x
    if (!isNaN(Number(req.params.x))) {
        if (req.params.x >= 0) {
            x = req.params.x;
        } else {
            logger.error('Parameter x must not be less than 0: ' + req.param.x);
            throw new Error('Parameter x must not be less than 0: ' + req.param.x);
        }
    } else {
        logger.error('Parameter x cannot be converted to a number: ' + req.param.x);
        throw new Error('Parameter x cannot be converted to a number: ' + req.param.x);
    }

    // y
    if (!isNaN(Number(req.params.y))) {
        if (req.params.y >= 0) {
            y = req.params.y;
        } else {
            logger.error('Parameter y must not be less than 0: ' + req.param.y);
            throw new Error('Parameter y must not be less than 0: ' + req.param.y);
        }
    } else {
        logger.error('Parameter y cannot be converted to a number: ' + req.param.y);
        throw new Error('Parameter y cannot be converted to a number: ' + req.param.y);
    }

    // z
    if (!isNaN(Number(req.params.z))) {
        if (req.params.z >= 0 && req.params.z <= 24) {
            params.zoom = req.params.z;
        } else {
            logger.error('Parameter z is out of range (0-24): ' + req.param.z);
            throw new Error('Parameter z is out of range (0-24): ' + req.param.z);
        }
    } else {
        logger.error('Parameter z cannot be converted to a number: ' + req.param.z);
        throw new Error('Parameter z cannot be converted to a number: ' + req.param.z);
    }

    // tile_size
    if (req.query.tile_size !== undefined) {
        if (!isNaN(Number(req.query.tile_size))) {
            if (req.query.tile_size > 0) {
                params.tileSize = +req.query.tile_size;
            } else {
                logger.error('Parameter tile_size must be greater than 0: ' + req.query.tile_size);
            }
        } else {
            logger.error('Parameter tile_size cannot be converted to a number: ' + req.query.tile_size);
        }
    }

    // Calculate center
    params.center = getTileCenter(params.zoom, x, y, params.tileSize);

    // No buffer for edge tiles
    const resultEdgeTile = isEdgeTile(params.zoom, x, y);
    // if (resultEdgeTile.x) {
    //     params.bufferWidth = 0;
    // }
    if (params.zoom == 0) {
        params.bufferWidth = 0;
    }
    if (resultEdgeTile.y) {
        params.bufferHeight = 0;
    }

    // ratio
    if (req.query.ratio !== undefined) {
        if (!isNaN(Number(req.query.ratio))) {
            if (req.query.ratio >= 0 && req.query.ratio <= 8) {
                params.ratio = +req.query.ratio;
            } else {
                logger.error('Parameter ratio is out of range (0-8): ' + req.query.ratio);
            }
        } else {
            logger.error('Parameter ratio cannot be converted to a number: ' + req.query.ratio);
        }
    }

    return params;
};

module.exports = { parseParameters };
