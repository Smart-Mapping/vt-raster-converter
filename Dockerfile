FROM ubuntu:24.04

WORKDIR /app

RUN apt-get update \
    && apt-get upgrade -y \
    && DEBIAN_FRONTEND="noninteractive" TZ="Europe/Berlin" apt-get install -y tzdata

RUN apt-get install -y \
    curl \
    libc6\
    libcurl4 \
    libgcc-s1 \
    libjpeg8 \
    libjpeg-turbo8 \
    libopengl0 \
    libuv1 \
    x11-utils \
    xvfb \
    libicu74 \
    libwebp7

RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs  

RUN apt-get remove -y curl krb5-locales gnupg && apt-get autoremove -y

COPY ./package-lock.json /app/package-lock.json
COPY ./package.json /app/package.json
RUN npm update -g && npm install

COPY . /app

ENV DISPLAY=:99
EXPOSE 8080

RUN groupadd -g 1099 converter \
    && useradd --shell /bin/bash --uid 1099 --gid 1099 -m converter
RUN chown -R converter:converter /app

RUN chmod 744 /app/entrypoint.sh
USER converter
ENTRYPOINT ["/app/entrypoint.sh"]
