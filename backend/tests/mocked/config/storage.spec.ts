import { describe, expect, jest, test } from '@jest/globals';
import type { DiskStorageOptions, Options } from 'multer';

const diskStorageMock = jest.fn((config: DiskStorageOptions) => config);
const memoryStorageMock = jest.fn(() => ({ type: 'memory' }));
const multerFactory = jest.fn((options: Options) => ({ options })) as jest.Mock<
  (options: Options) => { options: Options }
> & {
  diskStorage: typeof diskStorageMock;
  memoryStorage: typeof memoryStorageMock;
};

multerFactory.diskStorage = diskStorageMock;
multerFactory.memoryStorage = memoryStorageMock;

jest.mock('multer', () => ({
  __esModule: true,
  default: multerFactory,
}));

const randomBytesMock = jest.fn(() => Buffer.from('1234567890abcdef1234567890abcdef', 'hex'));

jest.mock('crypto', () => ({
  randomBytes: randomBytesMock,
}));

import { UPLOADS_ROOT } from '../../../src/config/paths';

const loadModule = () => {
  jest.isolateModules(() => {
    require('../../../src/config/storage');
  });
};

describe('Mocked: storage configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    diskStorageMock.mockClear();
    memoryStorageMock.mockClear();
    multerFactory.mockClear();
    randomBytesMock.mockClear();
  });

  // API: disk storage destination callback
  // Input: Multer invokes destination handler
  // Expected status code: n/a
  // Expected behavior: callback receives uploads root path
  // Expected output: cb called with null error and UPLOADS_ROOT
  test('uses uploads root as disk destination', () => {
    loadModule();

    const storageConfig = diskStorageMock.mock.calls[0][0] as Required<DiskStorageOptions>;
    const cb = jest.fn();
    const destination = storageConfig.destination as Exclude<DiskStorageOptions['destination'], string>;
    if (!destination) {
      throw new Error('destination callback missing');
    }
    destination({} as any, {} as any, cb);

    expect(cb).toHaveBeenCalledWith(null, UPLOADS_ROOT);
  });

  // API: disk storage filename callback
  // Input: file with uppercase extension
  // Expected status code: n/a
  // Expected behavior: generates random hex filename preserving lowercased extension
  // Expected output: cb receives filename ending in .jpg
  test('generates random filenames with deterministic extension', () => {
    loadModule();

    const storageConfig = diskStorageMock.mock.calls[0][0] as Required<DiskStorageOptions>;
    const cb = jest.fn();
    const filename = storageConfig.filename as NonNullable<DiskStorageOptions['filename']>;
    if (!filename) {
      throw new Error('filename callback missing');
    }
    filename({} as any, { originalname: 'Bird.JPG' } as any, cb);

    expect(randomBytesMock).toHaveBeenCalledWith(16);
    expect(cb).toHaveBeenCalledWith(
      null,
      expect.stringMatching(/^[0-9a-f]{32}\.jpg$/)
    );
  });

  // API: multer fileFilter
  // Input: mimetype image/* and text/plain
  // Expected status code: n/a
  // Expected behavior: accepts image mimetypes, rejects others with error
  // Expected output: cb called with (null, true) for images and Error for others
  test('filters files to image mimetypes', () => {
    loadModule();

    const options = multerFactory.mock.calls[0][0] as Options;
    const fileFilter = options.fileFilter as NonNullable<Options['fileFilter']>;
    const acceptCb = jest.fn();
    fileFilter({} as any, { mimetype: 'image/png' } as any, acceptCb);
    expect(acceptCb).toHaveBeenCalledWith(null, true);

    const rejectCb = jest.fn();
    fileFilter({} as any, { mimetype: 'text/plain' } as any, rejectCb);
    expect(rejectCb).toHaveBeenCalledWith(expect.any(Error));
  });
});
