import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, json, errors } = winston.format;

export const logger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'smart-ai-explorer' },
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'development'
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          : undefined,
    }),
  ],
});
