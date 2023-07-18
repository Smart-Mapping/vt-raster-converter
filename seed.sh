#! /bin/bash

## Run script (all caches): bash seed.sh
## Run test seeding: bash seed.sh test
## Run script (example for UMT32 colour):  bash seed.sh bm_web_col 25832

logFile="/data/basemap/logs/basemapde-web-raster-seed.log"

seeds=('bm_web_col_3857' 'bm_web_gry_3857' 'bm_web_col_25832' 'bm_web_gry_25832' 'bm_web_col_25833' 'bm_web_gry_25833')

testMode=false
seedFileName=seed.yaml

if [ -n "$1" ] && [ "${1}" = "test" ]
then
    testMode=true
    seedFileName=seed-test.yaml
elif [ -n "$1" ] && [ -n "$2" ]
then
    if [[ "${seeds[*]}" =~ "${1}_${2} " ]] || [[ "${seeds[*]}" =~ "${1}_${2}"$ ]]
    then
        seeds=("${1}_${2}")
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR - Parameters were specified, but seed configuration name is invalid: ${1}_${2}"
        exit 1
    fi
fi

if [ $testMode = true ]
then
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Run seeding in TEST mode" > $logFile
else 
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Run seeding in PRODUCTION mode" > $logFile
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Selected seeding configurations: ${seeds[*]}" >> ${logFile}

for seed in "${seeds[@]}"
do
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Start processing: ${seed}" >> $logFile

    ### Set variables
    seedsStr="${seed}_x8,${seed}"
    cacheName=${seed:0:10}
    epsg=${seed:11}

    if [ $epsg = "3857" ]
    then
        gridTempCache="EPSG_3857_x8"
    else
        gridTempCache="DE_EPSG_${epsg}_ADV_x8"
    fi
    gridFinalCache="DE_EPSG_${epsg}_ADV"

    filePrefix="BASEMAPDE_"
    if [[ $cacheName =~ "col"$ ]]
    then
        filePrefix+="HT_"
    else
        filePrefix+="GT_"
    fi
    filePrefix+="${epsg}_SQLT"

    pathTempCache="/data/mapproxy/cache_data/${cacheName}/${gridTempCache}"
    pathFinalCache="/data/mapproxy/cache_data/${cacheName}/${gridFinalCache}"
    pathOutput="/data/basemap/output/"

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Set path temporary cache: ${pathTempCache}" >> $logFile
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Set path finale cache: ${pathFinalCache}" >> $logFile
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Set path output: ${pathOutput}" >> $logFile


    ### Delete outdated caches   
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Delete outdated caches" >> $logFile
    podman unshare rm -rf $pathTempCache
    podman unshare rm -rf $pathFinalCache
    
    
    ### Start seeding
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Start seeding: ${seedsStr}" >> $logFile
    podman exec -it mapproxy mapproxy-seed -f /mapproxy/config/mapproxy.yaml -s /mapproxy/config/$seedFileName --log-config /mapproxy/config/log-seed.ini -c 16 --seed=$seedsStr
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Finished seeding: ${seedsStr}" >> $logFile

    ### Log tile statistics
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Number of tiles in MBTile files for: ${seed}" >> $logFile
    podman exec -it mapproxy python3 /mapproxy/test-cache.py /mapproxy/cache_data/${cacheName}/${gridFinalCache} >> $logFile

    ### Delete temporary Cache
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Delete temporary cache" >> $logFile
    podman unshare rm -rf $pathTempCache


    ### Delete old output files
    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Delete outdated files from output directory: ${pathOutput}/${filePrefix}" >> $logFile
    rm -f ${pathOutput}/${filePrefix}*

    
    ### Create packages for data transfer  
    cd ${pathOutput}

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Create archive and checksum for L00-L08" >> $logFile
    podman unshare tar cfvz ${filePrefix}_L00-L08.tar.gz -C ${pathFinalCache} 0.mbtile 1.mbtile 2.mbtile 3.mbtile 4.mbtile 5.mbtile 6.mbtile 7.mbtile 8.mbtile
    podman unshare md5sum ${filePrefix}_L00-L08.tar.gz > ${filePrefix}_L00-L08.tar.gz.md5

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Create archive and checksum for L09" >> $logFile
    podman unshare tar cfvz ${filePrefix}_L09.tar.gz -C ${pathFinalCache} 9.mbtile
    podman unshare md5sum ${filePrefix}_L09.tar.gz > ${filePrefix}_L09.tar.gz.md5

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Create archive and checksum for L10" >> $logFile
    podman unshare tar cfvz ${filePrefix}_L10.tar.gz -C ${pathFinalCache} 10.mbtile
    podman unshare md5sum ${filePrefix}_L10.tar.gz > ${filePrefix}_L10.tar.gz.md5

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Create archive and checksum for L11" >> $logFile
    podman unshare tar cfvz ${filePrefix}_L11.tar.gz -C ${pathFinalCache} 11.mbtile
    podman unshare md5sum ${filePrefix}_L11.tar.gz > ${filePrefix}_L11.tar.gz.md5

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Create archive and checksum for L12" >> $logFile
    podman unshare tar cfvz ${filePrefix}_L12.tar.gz -C ${pathFinalCache} 12.mbtile
    podman unshare md5sum ${filePrefix}_L12.tar.gz > ${filePrefix}_L12.tar.gz.md5

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Create archive and checksum for L13" >> $logFile
    podman unshare tar cfvz ${filePrefix}_L13.tar.gz -C ${pathFinalCache} 13.mbtile
    podman unshare md5sum ${filePrefix}_L13.tar.gz > ${filePrefix}_L13.tar.gz.md5

    echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Finished processing: ${seed}" >> $logFile
done

echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - All seedings completed" >> $logFile

logFileSic="${logFile:0:-4}_$(date '+%Y%m%d%H%M%S').log"
cp $logFile $logFileSic
echo "$(date '+%Y-%m-%d %H:%M:%S') INFO - Saved logs to ${logFileSic}" >> $logFile
