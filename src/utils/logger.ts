import { Logging } from '@google-cloud/logging';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private logging?: Logging;
  private logName = 'reviewthor';
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    if (!this.isDevelopment) {
      this.logging = new Logging();
    }
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warning', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context);
    }
  }

  private log(severity: string, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      severity,
      message,
      timestamp,
      ...context,
    };

    if (this.isDevelopment || !this.logging) {
      // Console logging for development
      const logMethod = severity === 'error' ? 'error' : severity === 'warning' ? 'warn' : 'log';
      // eslint-disable-next-line no-console
      console[logMethod](JSON.stringify(logEntry, null, 2));
    } else {
      // Google Cloud Logging for production
      try {
        const log = this.logging.log(this.logName);
        const metadata = {
          severity: severity.toUpperCase(),
          resource: { type: 'cloud_function' },
        };

        const entry = log.entry(metadata, logEntry);
        log.write(entry).catch((err) => {
          // Fallback to console if Cloud Logging fails
          // eslint-disable-next-line no-console
          console.error('Failed to write log:', err);
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(logEntry));
        });
      } catch (error) {
        // Fallback if log instance creation fails
        // eslint-disable-next-line no-console
        console.error('Failed to create log instance:', error);
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(logEntry));
      }
    }
  }
}

export const logger = new Logger();