import pino from 'pino';
import { config } from '../config';

/**
 * Structured JSON logger shared by every service.
 * `service` is bound per-process so logs can be filtered downstream.
 */
export function createLogger(service: string) {
  return pino({
    level: config.LOG_LEVEL,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
