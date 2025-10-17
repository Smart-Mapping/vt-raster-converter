const path = require('path');
const fs = require('fs');

const { resolveNamefromURL, resolveMBTilesURL, resolvePMTilesURL, renderImage } = require('../src/render');
const { imageDiff } = require('./util');

describe('resolve mbtiles URL', () => {
    it('should resolve mbtiles file name', () => {
        const sourceUrl = 'mbtiles://filename';
        const result = resolveNamefromURL(sourceUrl);
        expect(result).toBe('filename');
    });

    it('should resolve pmtiles file name', () => {
        const sourceUrl = 'pmtiles://filename';
        const result = resolveNamefromURL(sourceUrl);
        expect(result).toBe('filename');
    });

    it('should resolve a mbtiles URL to a file path', () => {
        const tilePath = '/data/tiles';
        const filename = 'mbtiles_file';
        const url = 'mbtiles://' + filename + '/0/0/0.pbf'

        const result = resolveMBTilesURL(tilePath, url);
        expect(result).toBe(tilePath + '/' + filename + '.mbtiles');
    });

    it('should resolve a pmtiles URL to a file path', () => {
        const tilePath = '/data/tiles';
        const filename = 'pmtiles_file';
        const url = 'pmtiles://' + filename + '/0/0/0.mvt'

        const result = resolvePMTilesURL(tilePath, url);
        expect(result).toBe(tilePath + '/' + filename + '.pmtiles');
    });
}); 

describe('renderImage - invalid parameters', () => {
    it('should throw error if style parameter is undefined', async () => {
        await expect(
            renderImage(null,
                [0, 0],
                0,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow('Style is a required parameter');
    });

    it('should throw error if style parameter is empty string', async () => {
        await expect(
            renderImage("",
                [0, 0],
                0,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow('Style is a required parameter');
    });  
    
    it('should throw error if center parameter is undefined', async () => {
        await expect(
            renderImage("style",
                null,
                0,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow();
    });  

    it('should throw error if center array has not lenght 2', async () => {
        await expect(
            renderImage("style",
                [1],
                0,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow(/Center must be longitude,latitude/);
    });    
    
    it('should throw error if center longitute is out of range', async () => {
        await expect(
            renderImage("style",
                [200, 0],
                0,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow(/Center longitude is outside world bounds/);
    }); 

    it('should throw error if center latitude is out of range', async () => {
        await expect(
            renderImage("style",
                [0, 200],
                0,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow(/Center latitude is outside world bounds/);
    }); 

    it('should throw error if zoom parameter is undefined', async () => {
        await expect(
            renderImage("style",
                [0, 0],
                null,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow('Zoom is a required parameter');
    }); 

    it('should throw error if zoom is out of range', async () => {
        await expect(
            renderImage("style",
                [0, 0],
                30,
                256,
                256,
                256,
                256,
                1,
                './fixtures'
            )
        ).rejects.toThrow(/Zoom level is outside supported range/);
    });    
});

describe('renderImage', () => {

    it('should render an image', async () => {
        const image = await renderImage("bm_web_col",
                                    [0, 0],
                                    1,
                                    256,
                                    256,
                                    256,
                                    256,
                                    1,
                                    path.join(__dirname, './fixtures')
                            );
        expect(image).not.toBeNull;
    });

    it('should render correct image', async () => {
        const image = await renderImage("bm_web_col",
                                    [0, 0],
                                    1,
                                    256,
                                    256,
                                    256,
                                    256,
                                    1,
                                    path.join(__dirname, './fixtures')
                            );

        const expectedPath = path.join(__dirname, './fixtures/world_1_0_0.png'
        )

        const diffPixels = await imageDiff(image, expectedPath)
        expect(diffPixels).toBeLessThan(50)
    });

    it('should render correct image 2048px', async () => {
        const image = await renderImage("bm_web_col",
                                    [10, 52],
                                    6,
                                    2048,
                                    2048,
                                    256,
                                    256,
                                    1,
                                    path.join(__dirname, './fixtures')
                            );

        const expectedPath = path.join(__dirname, './fixtures/world_6_10_52_large.png'
        )

        const diffPixels = await imageDiff(image, expectedPath)
        expect(diffPixels).toBeLessThan(50)
    });    
});
