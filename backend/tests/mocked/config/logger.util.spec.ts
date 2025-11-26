import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import logger from '../../../src/utils/logger.util';

describe('Mocked: logger.util', () => {
  let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  // API: logger.info
  // Input: message containing newline plus object argument
  // Expected status code: n/a
  // Expected behavior: sanitizes newline, stringifies object, and writes to stdout
  // Expected output: line prefixed with [INFO] including serialized args
  test('logger.info sanitizes args and writes to stdout', () => {
    logger.info('Hello\nWorld', { foo: 'bar' });

    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] Hello\\nWorld {"foo":"bar"}\n')
    );
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // API: logger.error
  // Input: error object as argument
  // Expected status code: n/a
  // Expected behavior: writes stack trace to stderr with [ERROR] prefix
  // Expected output: stderr line containing error message
  test('logger.error writes stack trace to stderr', () => {
    const error = new Error('boom');

    logger.error('Something failed', error);

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Something failed'));
    expect(stderrSpy.mock.calls[0][0]).toContain('boom');
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  test('logger.debug writes to stdout with prefixed level', () => {
    logger.debug('Debug message', { flag: true });

    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Debug message'));
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  test('logger.info skips arguments that cannot be stringified', () => {
    const circular: any = {};
    circular.self = circular;

    logger.info('Handles circular', circular);

    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Handles circular'));
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
