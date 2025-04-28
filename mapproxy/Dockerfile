FROM python:3.13-alpine

RUN apk update && apk add gcc proj proj-dev proj-util musl-dev git

RUN python3 -m pip install --upgrade pip setuptools wheel

RUN pip install Pillow PyYAML git+https://github.com/pyproj4/pyproj.git six MapProxy==3.1.4

RUN python -m pip uninstall -y pip

RUN apk del git gcc && apk upgrade

RUN addgroup -g 1099 mapproxy \
    && adduser -s /bin/bash -u 1099 -D -G mapproxy mapproxy

WORKDIR /mapproxy

COPY ./config ./config
COPY ./src/test-cache.py ./test-cache.py
COPY ./src/app.py ./app.py

RUN mkdir cache_data && chown -R mapproxy:mapproxy cache_data
RUN mkdir /logs && chown -R mapproxy:mapproxy /logs

USER mapproxy
ENV MAPPROXY_PROCESSES 4
ENV MAPPROXY_THREADS 2
EXPOSE 8080

CMD mapproxy-util serve-develop -b 0.0.0.0:8080 ./config/mapproxy.yaml