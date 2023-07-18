const winston = require('winston');
const { combine, timestamp, printf, align } = winston.format;

let transports = [
    new winston.transports.Console(),
];

if (process.env.LOG_FILE !== undefined && process.env.LOG_FILE.length > 0) {
    transports.push(new winston.transports.File({
        filename: process.env.LOG_FILE
    }));
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'error',
    format: combine(
        timestamp({
            format: 'YYYY-MM-DD hh:mm:ss.SSS A',
        }),
        align(),
        printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
    ),
    transports: transports
});

module.exports = logger;