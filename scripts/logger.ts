import { createLogger, format, transports } from 'winston';

const logger = createLogger({
	levels: {
		error: 0,
		warn: 1,
		info: 2,
		debug: 3,
		dump: 4,
	},
	level: process.env.LOG_LEVEL || 'info',
	format: format.combine(
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
	),
	transports: [
		new transports.Console(), // Log to the console
		new transports.File({ filename: 'app.log' }) // Log to a file
	]
});

export default logger;