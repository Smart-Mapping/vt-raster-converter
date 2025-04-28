## v1.5.2 (2025-04-28)

### Maintenance
* Update MapProxy to v3.1.4
* Dependency updates

## v1.5.1 (2025-03-11)

### Bug fixes
* Limit parameter ratio to values 1 - 8 (value 0 removed).

## v1.5.0 (2025-01-22)

### Maintenance
* Update MapLibre Native to v6.0.0
* Update MapProxy to v3.1.3
* Dependency updates
* Migrate ESLint configuration

### Bug fixes
* Fix wrong variable names in getRemoteTile() and getRemoteAsset().

## v1.4.4 (2024-11-25)

### Bug fixes
* Library updates

## v1.4.3 (2024-09-11)

### Bug fixes
* Library updates

## v1.4.2 (2024-08-27)

### Updates
* Update MapProxy to v2

## v1.4.1 (2024-06-03)

### Bug fixes
* Library updates

## v1.4.0 (2024-05-08)

### Changes
* Add functions to request remote tiles and assets.

## v1.3.1 (2024-01-19)

### Bug fixes
* Fix installation of Node.js in Dockerfile.

## v1.3.0 (2023-11-23)

### Changes
* Rename style files

## v1.2.6 (2023-10-26)

### Bug fixes
* Remove gnupg from converter Dockerfile to avoid vulnerabilities.

## v1.2.5 (2023-10-25)

### Bug fixes
* Library updates

## v1.2.4 (2023-10-12)

### Bug fixes
* Remove gcc from MapProxy Dockerfile to avoid vulnerabilities.

## v1.2.3 (2023-07-19)

### Bug fixes
* Fix pyproj installation error in MapProxy Dockerfile.

## v1.2.2 (2023-07-18)

* Open source release
* Add documentation
* Update MapProxy to v1.16.0

## v1.2.1 (2023-04-03)

* Fix missing zoom level 13 in cache test

## v1.2.0 (2023-03-23)

* Add test-cache.py to MapProxy image to count tiles in mbtile files

## v1.1.4 (2023-03-20)

* Update python in mapproxy image to v3.11
* npm package updates

## v1.1.3 (2023-03-01)

* Set separate buffers for image width and height to fix label problems in low zoom levels

## v1.1.2 (2023-02-22)

* Remove pip in MapProxy dockerfile
* Update global npm packages in converter dockerfile

## v1.1.1 (2023-02-13)

* Deactivate MapProxy WMS and demo services
* Add npm audit fix to converter dockerfile

## v1.1.0 (2023-01-24)

* Add environment variable NODE_MEMORY_LIMIT to set maximal memory limit for NodeJS 

## v1.0.0 (2023-01-10)

* Initial release
