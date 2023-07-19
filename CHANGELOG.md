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
