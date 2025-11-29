import { sanitizeArgs, sanitizeInput } from './sanitizeInput.util';

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';

const writeLog = (level: LogLevel, message: string, args: unknown[]): void => {
  const safeMessage = sanitizeInput(message);
  const safeArgs = sanitizeArgs(args)
    .map(value => {
      if (typeof value === 'string') {
        return value;
      }
      if (value instanceof Error) {
        return sanitizeInput(value.message);
      }
      try {
        return sanitizeInput(JSON.stringify(value));
      } catch {
        return undefined;
      }
    })
    .filter(Boolean);

  const body = [safeMessage, ...safeArgs].join(' ');
  const output = `[${level}]${body ? ` ${body}` : ''}`;

  switch (level) {
    case 'ERROR':
    case 'WARN':
      process.stderr.write(`${output}\n`);
      break;
    default:
      process.stdout.write(`${output}\n`);
  }
};

const logger = {
  info: (message: string, ...args: unknown[]) => {
    writeLog('INFO', message, args);
  },
  error: (message: string, ...args: unknown[]) => {
    writeLog('ERROR', message, args);
  },
  warn: (message: string, ...args: unknown[]) => {
    writeLog('WARN', message, args);
  },
  debug: (message: string, ...args: unknown[]) => {
    writeLog('DEBUG', message, args);
  },
};

export default logger;
