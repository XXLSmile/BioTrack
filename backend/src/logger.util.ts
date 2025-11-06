import { sanitizeArgs, sanitizeInput } from './sanitizeInput.util';

const formatLogMessage = (level: string, message: string, args: unknown[]): string => {
  const safeMessage = sanitizeInput(message);
  const safeArgs = sanitizeArgs(args).map(value => String(value));
  const segments = [safeMessage, ...safeArgs].filter(segment => segment.length > 0);
  const body = segments.length > 0 ? ` ${segments.join(' ')}` : '';
  return `[${level}]${body}`;
};

const writeLog = (stream: NodeJS.WriteStream, level: string, message: string, args: unknown[]): void => {
  const output = formatLogMessage(level, message, args);
  stream.write(`${output}\n`);
};

const logger = {
  info: (message: string, ...args: unknown[]) => {
    writeLog(process.stdout, 'INFO', message, args);
  },
  error: (message: string, ...args: unknown[]) => {
    writeLog(process.stderr, 'ERROR', message, args);
  },
  warn: (message: string, ...args: unknown[]) => {
    writeLog(process.stderr, 'WARN', message, args);
  },
  debug: (message: string, ...args: unknown[]) => {
    writeLog(process.stdout, 'DEBUG', message, args);
  },
};

export default logger;
