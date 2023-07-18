// This module is derived from https://github.com/consbio/mbgl-renderer

const sharp = require('sharp');
const pixelmatch = require('pixelmatch');

/**
 * Uses `pixelmatch` to calculate the number of pixels that are different between
 * the PNG data produced by `render` and the data in the expected PNG file.
 *
 * @param {Buffer} pngData - buffer of PNG data produced by render function
 * @param {String} expectedPath - path to PNG file of expected data from test suite
 *
 * Returns {Number} - count of pixels that are different between the 2 images.
 */
const imageDiff = async (pngData, expectedPath) => {
    const pngImage = await sharp(pngData)
    const { width, height } = await pngImage.metadata()

    // Convert the pixels to raw byte buffer
    const rawData = await pngImage.raw().toBuffer()

    // read the expected data and convert to raw byte buffer
    const expected = await sharp(expectedPath)
        .raw()
        .toBuffer()

    return pixelmatch(rawData, expected, null, width, height)
}

module.exports = { imageDiff };