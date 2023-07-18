const { parseParameters } = require('../src/server');

const config = require('../src/config/config.json');

describe('parseParameters', () => {
    let req = {};

    beforeEach(() => {
        req = {
            params: {
                style: Object.keys(config.styles)[0],
                x: 0,
                y: 0,
                z: 0,
                format: 'png'
            },
            query: {}
        }
    });

    // style
    it('should return style for a valid style parameter', () => {
        const result = parseParameters(req);
        expect(result.style).not.toBeNull();
    });

    it('should throw error for invalid style parameter', () => {
        req.params.style = 'invalid_style_name';
        
        const func = () => {
            parseParameters(req);
        }
        expect(func).toThrow();
    });

    // x
    it('should throw error if x is NaN', () => {
        req.params.x = 'invalid input';

        const func = () => {
            parseParameters(req);
        }
        expect(func).toThrow();
    });

    it('should throw error if x is less than 0', () => {
        req.params.x = -1;

        const func = () => {
            parseParameters(req);
        }
        expect(func).toThrow();
    });

    // y
    it('should throw error if y is NaN', () => {
        req.params.y = 'invalid input';

        const func = () => {
            parseParameters(req);
        }
        expect(func).toThrow();
    });

    it('should throw error if y is less than 0', () => {
        req.params.y = -1;

        const func = () => {
            parseParameters(req);
        }
        expect(func).toThrow();
    });
    
    // z
    it('should throw error if z is NaN', () => {
        req.params.z = 'invalid input';

        const func = () => {
            parseParameters(req);
        }
        expect(func).toThrow();
    });

    it('should throw error if z is out of range', () => {
        req.params.z = -1;

        const func = () => {
            parseParameters(req);
        }
        expect(func).toThrow();

        req.params.z = 30;

        const func2 = () => {
            parseParameters(req);
        }
        expect(func2).toThrow();
    });

    it('should set z to valid parameter value', () => {
        req.params.z = 15;

        const result = parseParameters(req);
        expect(result.zoom).toBe(15);
    });        

    // tileSize
    it('should set tileSize to 256 if not defined', () => {
        const result = parseParameters(req);
        expect(result.tileSize).toBe(256);
    });

    it('should set tileSize to 256 if parameter is out of range', () => {
        req.query = {
            tile_size: -1
        };

        const result = parseParameters(req);
        expect(result.tileSize).toBe(256);
    });

    it('should set tileSize to 256 if parameter NaN', () => {
        req.query = {
            tile_size: 'text'
        };

        const result = parseParameters(req);
        expect(result.tileSize).toBe(256);
    });

    it('should set tileSize to valid parameter value', () => {
        req.query = {
            tile_size: 512
        };

        const result = parseParameters(req);
        expect(result.tileSize).toBe(512);
    });

    // ratio
    it('should set ratio to 1 if not defined', () => {
        const result = parseParameters(req);
        expect(result.ratio).toBe(1);
    });

    it('should set ratio to 1 if parameter is out of range', () => {
        req.query = {
            ratio: -1
        };

        const result = parseParameters(req);
        expect(result.ratio).toBe(1);

        req.query = {
            ratio: 200
        };

        const result2 = parseParameters(req);
        expect(result2.ratio).toBe(1);
    });

    it('should set ratio to 1 if parameter NaN', () => {
        req.query = {
            ratio: 'text'
        };

        const result = parseParameters(req);
        expect(result.ratio).toBe(1);
    });

    it('should set ratio to number from string', () => {
        req.query = {
            ratio: '2'
        };

        const result = parseParameters(req);
        expect(result.ratio).toBe(2);
    });    

    it('should set ratio to valid parameter value', () => {
        req.query = {
            ratio: 8
        };

        const result = parseParameters(req);
        expect(result.ratio).toBe(8);
    });
});