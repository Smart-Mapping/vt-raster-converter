const { getTileCenter, metersToLatLon, pixelsToMeters, isEdgeTile } = require('../src/coordinates');

describe('getTileCenter', () => {
    it('should return coordinate as array', () => {
        const zoom = 0;
        const x = 0;
        const y = 0;

        const result = getTileCenter(zoom, x, y);
        // expect(result).toBeTypeOf('object');
        expect(result.length).toBe(2);
    });

    it('should return correct lon/lat values for a tile', () => {
        const zoom = 4;
        const x = 8;
        const y = 5;

        const result = getTileCenter(zoom, x, y);
        expect(Math.round(result[0] * 100000) / 100000).toBe(11.25000);
        expect(Math.round(result[1] * 100000) / 100000).toBe(48.92250);
    });

    it('should return correct lon/lat values for a tile with custom tileSize', () => {
        const zoom = 1;
        const x = 0;
        const y = 0;
        const tileSize = 512

        const result = getTileCenter(zoom, x, y, tileSize);
        expect(Math.round(result[0] * 100000) / 100000).toBe(0);
        expect(Math.round(result[1] * 100000) / 100000).toBe(0);
    });
});

describe('metersToLatLon', () => {
    it('should return coordinate as array', () => {
        const x = 0;
        const y = 0;

        const result = metersToLatLon(x, y);
        // expect(result).toBeTypeOf('object');
        expect(result.length).toBe(2);
    });

    it('should transform Webmercator coordinate (EPSG:3857) to lon/lat coordinate (EPSG:4326)', () => {
        const x = 2504688.5;
        const y = 7514065.5;

        const result = metersToLatLon(x, y);
        expect(result).toEqual([22.49999961508398, 55.77657236921255]);
    });
});

describe('pixelsToMeters', () => {
    it('should return coordinate as array', () => {
        const zoom = 0;
        const px = 0;
        const py = 0;

        const result = pixelsToMeters(px, py, zoom);
        // expect(result).toBeTypeOf('object');
        expect(result.length).toBe(2);
    });

    it('should transform pixel coordinate to Webmercator coordinate (EPSG:3857)', () => {
        // Center of tile 4/8/5
        const zoom = 4;
        const px = 2176;
        const py = 1408;

        const result = pixelsToMeters(px, py, zoom);
        expect(result).toEqual([1252344.271424327, 6261721.357121639]);
    });
});

describe('isEdgeTile', () => {
    it('should return true for tile on north edge of grid', () => {
        const zoom = 2;
        const x = 1;
        const y = 0;

        const result = isEdgeTile(zoom, x, y);
        expect(result).toEqual({x: false, y: true});
    });

    it('should return true for tile on west edge of grid', () => {
        const zoom = 2;
        const x = 0;
        const y = 1;

        const result = isEdgeTile(zoom, x, y);
        expect(result).toEqual({x: true, y: false});
    });
    
    it('should return true for tile on south edge of grid', () => {
        const zoom = 2;
        const x = 1;
        const y = 3;

        const result = isEdgeTile(zoom, x, y);
        expect(result).toEqual({x: false, y: true});
    });
    
    it('should return true for tile on east edge of grid', () => {
        const zoom = 2;
        const x = 3;
        const y = 1;

        const result = isEdgeTile(zoom, x, y);
        expect(result).toEqual({x: true, y: false});
    });    

    it('should return true for tile not on the grid edge', () => {
        const zoom = 2;
        const x = 1;
        const y = 2;

        const result = isEdgeTile(zoom, x, y);
        expect(result).toEqual({x: false, y: false});
    }); 
});