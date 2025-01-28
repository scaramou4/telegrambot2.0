const { createLogger, format, transports } = require('winston');
const path = require('path');

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'telegram-bot' },
    transports: [
        new transports.File({ filename: path.join(__dirname, '../../logs/bot.log'), level: 'info' }),
        new transports.Console({
            format: format.combine(format.colorize(), format.simple()),
        }),
    ],
});

// Дополнительная функция для записи событий с `chatId` и `username`
logger.logChatEvent = (chatId, username, eventDetails) => {
    logger.info({
        chatId,
        username: username || 'Unknown', // Если username отсутствует
        eventDetails,
    });
};

module.exports = logger;