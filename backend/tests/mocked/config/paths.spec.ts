import { describe, expect, jest, test } from '@jest/globals';

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
  },
}));

const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
};

jest.mock('fs', () => mockFs);

describe('Mocked: config/paths', () => {
  beforeEach(() => {
    jest.resetModules();
    mockFs.existsSync.mockReset();
    mockFs.mkdirSync.mockReset();
  });

  test('creates uploads directory when missing', () => {
    mockFs.existsSync.mockReturnValueOnce(false);

    jest.isolateModules(() => {
      const { UPLOADS_ROOT } = require('../../../src/config/paths');
      expect(typeof UPLOADS_ROOT).toBe('string');
    });

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  test('does not create directory when already present', () => {
    mockFs.existsSync.mockReturnValueOnce(true);

    jest.isolateModules(() => {
      require('../../../src/config/paths');
    });

    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
  });
});
