import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const existsSyncMock = jest.fn();
const readFileSyncMock = jest.fn();

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
  },
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock,
}));

const apps: any[] = [];
const credentialCertMock = jest.fn(() => ({ cert: true }));
const initializeAppMock = jest.fn(config => {
  apps.push(config);
  return config;
});
const messagingInstance = { send: jest.fn(async () => 'message-id') };
const messagingFactoryMock = jest.fn(() => messagingInstance);

jest.mock('firebase-admin', () => ({
  __esModule: true,
  default: {
    apps,
    credential: { cert: credentialCertMock },
    initializeApp: initializeAppMock,
    messaging: messagingFactoryMock,
  },
  credential: { cert: credentialCertMock },
  initializeApp: initializeAppMock,
  messaging: messagingFactoryMock,
}));

describe('Mocked: firebase bootstrap', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    credentialCertMock.mockClear();
    initializeAppMock.mockClear();
    messagingFactoryMock.mockClear();
    messagingInstance.send.mockClear();
    apps.length = 0;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const loadModule = () => {
    let moduleExports: typeof import('../../../src/config/firebase');
    jest.isolateModules(() => {
      moduleExports = require('../../../src/config/firebase');
    });
    return moduleExports!;
  };

  // API: firebase messaging bootstrap
  // Input: service account file present
  // Expected status code: n/a
  // Expected behavior: initializes Firebase using credential cert and exposes messaging instance
  // Expected output: exported messaging matches admin.messaging() return
  test('initializes with service account credentials when file exists', () => {
    existsSyncMock.mockReturnValueOnce(true);
    readFileSyncMock.mockReturnValueOnce(JSON.stringify({ project_id: 'demo' }));

    const moduleExports = loadModule();

    expect(readFileSyncMock).toHaveBeenCalled();
    expect(credentialCertMock).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'demo' })
    );
    expect(initializeAppMock).toHaveBeenCalledWith({
      credential: expect.any(Object),
    });

    // messaging is a thin adapter around admin.messaging().send(...)
    expect(typeof moduleExports.messaging.send).toBe('function');

    // Verify that messaging.send delegates to admin.messaging().send
    const message = { data: { foo: 'bar' } } as any;
    const resultPromise = moduleExports.messaging.send(message, true);

    expect(messagingFactoryMock).toHaveBeenCalledTimes(1);
    expect(messagingInstance.send).toHaveBeenCalledWith(message, true);
    expect(resultPromise).resolves.toBe('message-id');
  });

  // API: firebase messaging bootstrap
  // Input: service account file missing, NODE_ENV=development
  // Expected status code: n/a
  // Expected behavior: initializes app with fallback project and noop messaging warns when send invoked
  // Expected output: messaging.send resolves empty string after logging warning
  test('falls back to noop messaging when credentials missing', async () => {
    existsSyncMock.mockReturnValueOnce(false);
    process.env.NODE_ENV = 'development';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const moduleExports = loadModule();
    const response = await moduleExports.messaging.send({ data: 'demo' } as any);

    expect(initializeAppMock).toHaveBeenCalledWith({
      projectId: 'local-dev',
    });
    expect(response).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      'Firebase service account not found. Messaging send() invoked in noop mode.'
    );

    warnSpy.mockRestore();
  });
});
