# VT Raster Converter

Convert vector tiles to raster tiles with [MapLibre GL Native](https://github.com/maplibre/maplibre-gl-native) and store them with [MapProxy](https://mapproxy.org/).

This software is developed and used for the production of the maps of [basemap.de Web Raster](https://basemap.de/web_raster/). The aim of the software is not to offer the greatest possible range of configurations and interfaces, but to optimize performance in the production of very large raster tile archives.

## Getting Started

### Prerequisites

You need version 14, 16 or 18 of [Node.js](https://nodejs.org) to run VT Raster Converter locally.

VT Raster Converter uses the Node.js library of MapLibre GL Native to convert vector tile maps to raster images. The Maplibre GL Native binaries have very specific dependencies, so only very specific operating systems are supported. For more information see [@maplibre/maplibre-gl-native](https://github.com/maplibre/maplibre-native/tree/main/platform/node).

We recommend running VT Raster Converter as a Docker container, which ensures all dependencies are met.

### Create data folder

VT Raster Converter requires input data (vector tiles, styles, fonts/glyphs and sprites) from which raster images are created. This data must be stored in a predefined local folder structure. To achieve optimal performance, VT Raster Converter can only read locally stored files from the data folder.

```
 |- data
     |- fonts
         |- <font-name>
             |- 0-255.pbf
             |- ...
     |- sprites
         |- <sprite-name>.json
         |- <sprite-name>.png
         |- ...
     |- styles
         |- <style-name>.json
         |- ...
     |- tiles
         |- <mbtiles-name>.mbtiles
         |- ...
```

A data folder with sample data can be found under [docs/example_configurations/data](docs/example_configurations/data/).

#### fonts

The fonts folder contains [glyph sets in PBF format](https://maplibre.org/maplibre-style-spec/glyphs/). All glyph sets used in the style files, must be stored locally in the data folder. A useful script for converting font files to glyph sets can be found in the [OpenMapTiles fonts repository](https://github.com/openmaptiles/fonts).

#### sprites

The sprites folder contains [sprite files](https://maplibre.org/maplibre-style-spec/sprite/) which are composed of a PNG image and a JSON index file. All sprites used in the style files, must be stored locally in the data folder.

#### tiles

As input data VT Raster Converter can read vector tiles in [MBTiles format](https://github.com/mapbox/mbtiles-spec). All vector tiles used as sources in the style files, must be stored locally in the data folder.

If you have vector tiles in PBF format, you can convert them to an MBTiles file using [mbutil](https://github.com/mapbox/mbutil).


##### Troubleshooting 

Technically, MBTiles is a SQLite database. It contains a table called "metadata". Malibre GL Native expects the attributes in the table to be in certain formats. Depending on the software used to create the MBTiles file, the table "metadata" may contain information that causes errors in MapLibre GL Native. If the information about "bounds" and "center" in the table "metadata" is not in the necessary format, this can lead to the following error message in VT Raster Converter:

```
error: bounds array must contain numeric longitude and latitude values
```

To fix the error, open the MBTiles file with a SQLite client and execute the following SQL command:

```sql
DELETE FROM metadata WHERE name='center' OR name='bounds';
```

#### styles

This folder contains the vector tile style files. All vector tile styles used used by VT Raster Converter, must be stored locally in the data folder.

The style files contain URLs to the MBTile files and possibly to fonts and sprites if they are used in the style. Here is an example of how the tiles, fonts and sprites are specified in the style file. The URLs to a MBTiles file and a sprite are specified without file extensions. The specified files are searched in the corresponding subfolders of the data folder.

```json
...
"sources": {
    "world": {
        "type": "vector",
        "url": "mbtiles://world"
    }
},
"glyphs": "{fontstack}/{range}.pbf",
"sprite": "example-sprite",
...
```

### Customize configuration

In the [configuration file](src/config/config.json) you define which vector tile style files can be read by the converter. 

```json
{
    "server": {
        "port": 8081
    }, 
    "styles": {
        "style-color": {
            "file": "style_1.json"
        },
        "style-gray": {
            "file": "style_2.json"
        }
    }
}
```

#### server

`port`: integer

Port for the service. The port configuration can be overridden by an [environment variable](#set-environment-variables).

#### styles

`<style-name>`: object

The name of the JSON attribute is used to refer to a style file in the subfolder "styles" of the data folder. In the example above, the style file "style_1.json" is addressed via "style-color" in the URL request (e. g. http://localhost:8081/tiles/style-color/{z}/{x}/{y}). 
Since the style name becomes part of URL requests, it must only consist of characters that are allowed in URLs.

`file`: string

Name of a style file, which is stored in the subfolder "styles" of the data folder.


### Set environment variables

The following environment variables must/can be set to customize the configuration of VT Raster Converter. See [docker-compose.yaml](docker-compose.yaml) for examples.

`DATA_PATH`: string (mandatory)

Path to the data folder. This environment variable is mandatory for the converter to start. 

`LOG_LEVEL`: debug | info | warning | error

Optional setting of the log level. The default value is "error".

`LOG_FILE`: string

Optional path to a log file. If this variable is not set, the logs are only be output to the console.

`NODE_MEMORY_LIMIT`: integer

Optional setting of the Node.js parameter `--max-old-space-size`. The memory size is specified in MB.

### Start Docker environment

Build and start with Docker Compose:

```sh
docker compose up --build
```

Or build and start with Docker Compose using sample data:
 
```sh
docker compose -f docker-compose-example.yaml up --build
```

Now you can request the API: 

[http://localhost:8081/ping](http://localhost:8081/ping)

[http://localhost:8081/tiles/example-style/0/0/0](http://localhost:8081/tiles/example-style/0/0/0)

MapProxy demo page: [http://localhost:8080/demo](http://localhost:8080/demo)


## API

VT Raster Converter can be requested via the following API:

### tiles

URL: `http://localhost:8081/tiles/{style-name}/{z}/{x}/{y}`

`style-name`: string

It must be a style name spezified in the [configuration tile](#customize-configuration)

`z`: integer (0 - 24)

Zoom level of the requested tile. Note that this is the raster zoom level, which is one level higher than the corresponding vector zoom level (e. g. raster zoom level 2 = vector zoom level 1). The available zoom levels depend on the configuration of the underlying vector tile style. 

`x`: integer

Number of the column in the tile grid.

`y`: integer

Number of the row in the tile grid.

#### Additional query parameters

The request can be extended by the following query parameters:

`ratio`: number (1 - 8)

Ratio of the image, to create images with high resolution. The default value is "1", for images with standard resolution.

Example:

```
http://localhost:8081/tiles/example-style/0/0/0?ratio=4
```

`tile_size`: number

Size of the requested raster tile. The default value is "256". In low zoom levels, an increased tile size can lead to incorrect rendering.

Example: 

```
http://localhost:8081/tiles/example-style/8/134/85?tile_size=1024
```

### ping

URL: `http://localhost:8081/ping`

Function to check the availability of the service. It will return the text "true" if the service is available.

## Development

Please refer to the notes on supported operating systems in the section [Prerequisites](#prerequisites) if you want to run and test the application locally via NPM.

Clone this repository and navigate to the project folder. Then install the dependencies:

```sh
npm install
```

Set [environment variable](#set-environment-variables) DATA_PATH to data folder and start the development server:

```
export DATA_PATH=/path/to/data
npm start
```

Now you can request the API: [http://localhost:8081/ping](http://localhost:8081/ping)

Test the application:

```sh
npm test
```

Linting code (with or without fixing errors):

```sh
npm run lint
npm run lint:fix
```

## Use MapProxy to store raster tiles

VT Raster Converter can be included as a [tile source](https://mapproxy.org/docs/nightly/sources.html#tiles) in MapProxy.


```yaml
sources:
  vt-raster-converter:
    type: tile
    grid: GLOBAL_WEBMERCATOR
    url: http://converter:8081/tiles/example-style/%(z)s/%(x)s/%(y)s  
```

For a complete example of a MapProxy configuration see [mapproxy.yaml](mapproxy/config/mapproxy.yaml).

### Best practices

Examples of the best practices listed here can be seen in the [MapProxy](mapproxy/config/mapproxy.yaml) and [seeding](mapproxy/config/seed.yaml) configuration in this repository.

* VT Raster Converter is optimized for horizontal scaling. To improve the performance when seeding large tile archives, several instances of the converter should be started and addressed via load balancing.
* The performance can be greatly improved by requesting images with a larger [tile_size](#additional-query-parameters) (e.g. 2048px) and then cutting them to the target size of 256px by MapProxy. Please note that an increased tile size should only be used for larger zoom levels to avoid rendering problems in the tiles.

### Use custom coordinate systems

VT Raster Converter, respectively MapLibre GL Native, can only process data in Webmercator (EPSG:3857). Nevertheless, VT Raster Converter and MapProxy can be used to create raster images in other coordinate systems. This is only tested for "ETRS89 / UTM zone 32N" (EPSG:25832) and "ETRS89 / UTM zone 33N" (EPSG:25833) in the extend of germany and may not work for other coordinate systems or extents.

You need to create your vector tiles and styles in the desired coordinate system and set the "sources" and "caches" in Maproxy to this coordinate system. However, the converter treats the data as if it were in Webmercator, which can lead to problems or errors in the rendering depending on the coordinate system. So just test it!

## License
MIT License. For more information see [LICENSE.txt](LICENSE.txt).

Copyright 2023 Landesamt für Geoinformation und Landesvermessung Niedersachsen
