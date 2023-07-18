#!/bin/sh

# Start Xvfb
echo "Starting Xvfb"
Xvfb ${DISPLAY} -screen 0 "1024x768x24" -ac +extension GLX +render -noreset  -nolisten tcp -nolisten unix &
Xvfb_pid="$!"
echo "Waiting for Xvfb (PID: $Xvfb_pid) to be ready..."
while ! xdpyinfo -display ${DISPLAY} > /dev/null 2>&1; do
    sleep 0.1
done
echo "Xvfb is running"

if [ -z "${NODE_MEMORY_LIMIT}" ]; then
    params=""
    echo "Starting script"
else 
    params="--max-old-space-size=${NODE_MEMORY_LIMIT}"
    echo "Starting script with memory limit ${NODE_MEMORY_LIMIT} MB"
fi

node ${params} src/server.js