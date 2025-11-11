import { afterEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'fs';

import * as safeFs from '../../../src/utils/safeFs';

describe('Mocked: safeFs utility', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('delegates filesystem helpers to node fs', () => {
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
    const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(Buffer.from('data'));
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const renameSpy = jest.spyOn(fs, 'renameSync').mockImplementation(() => undefined);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

    safeFs.ensureDirSync('/tmp/dir');
    expect(mkdirSpy).toHaveBeenCalledWith('/tmp/dir', { recursive: true });

    const existsResult = safeFs.existsSync('/tmp/file');
    expect(existsResult).toBe(true);
    expect(existsSpy).toHaveBeenCalledWith('/tmp/file');

    const buffer = safeFs.readFileBufferSync('/tmp/file');
    expect(buffer).toEqual(Buffer.from('data'));
    expect(readSpy).toHaveBeenCalledWith('/tmp/file');

    const payload = Buffer.from('node');
    safeFs.writeFileSync('/tmp/file', payload);
    expect(writeSpy).toHaveBeenCalledWith('/tmp/file', payload);

    safeFs.renameSync('/tmp/file', '/tmp/file.new');
    expect(renameSpy).toHaveBeenCalledWith('/tmp/file', '/tmp/file.new');

    safeFs.unlinkSync('/tmp/file.new');
    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/file.new');
  });
});
