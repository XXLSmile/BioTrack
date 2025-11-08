import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import http from 'http';
import mongoose from 'mongoose';
import type { ICatalog } from '../../../src/catalog/catalog.types';

const mockLogger = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
};

jest.mock('../../../src/logger.util', () => ({
  __esModule: true,
  default: mockLogger,
}));

const mockUserModel = {
  findById: jest.fn<(...args: any[]) => Promise<any>>(),
};

jest.mock('../../../src/user/user.model', () => ({
  userModel: mockUserModel,
}));

const mockCatalogModel = {
  findById: jest.fn<(...args: any[]) => Promise<any>>(),
};

jest.mock('../../../src/catalog/catalog.model', () => ({
  catalogModel: mockCatalogModel,
}));

const mockCatalogShareModel = {
  getUserAccess: jest.fn<(...args: any[]) => Promise<any>>(),
};

jest.mock('../../../src/catalog/catalogShare.model', () => ({
  catalogShareModel: mockCatalogShareModel,
}));

const jwtVerifyMock = jest.fn();

jest.mock('jsonwebtoken', () => ({
  verify: (...args: unknown[]) => jwtVerifyMock(...args),
}));

const serverInstances: any[] = [];

const createMockServer = () => {
  const roomEmit = jest.fn();
  const instance: any = {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: roomEmit }),
    emit: roomEmit,
  };
  instance.join = jest.fn();
  instance.leave = jest.fn();
  instance.__roomEmit = roomEmit;
  serverInstances.push(instance);
  return instance;
};

const ServerConstructor = jest.fn(() => createMockServer());

jest.mock('socket.io', () => ({
  Server: ServerConstructor,
}));

const loadSocketModule = () => {
  let moduleExports: typeof import('../../../src/socket/socket.manager');
  jest.isolateModules(() => {
    moduleExports = require('../../../src/socket/socket.manager');
  });
  return moduleExports!;
};

describe('Mocked: socket.manager', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    serverInstances.length = 0;
    ServerConstructor.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    Object.values(mockUserModel).forEach(fn => fn.mockReset?.());
    Object.values(mockCatalogModel).forEach(fn => fn.mockReset?.());
    Object.values(mockCatalogShareModel).forEach(fn => fn.mockReset?.());
    jwtVerifyMock.mockReset();
    Object.assign(process.env, originalEnv);
    delete process.env.DISABLE_AUTH;
    delete process.env.TEST_USER_ID;
    delete process.env.JWT_SECRET;
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  const initializeConnectedSocket = () => {
    process.env.JWT_SECRET = 'secret';
    const userId = new mongoose.Types.ObjectId().toString();
    jwtVerifyMock.mockReturnValue({ id: userId });
    mockUserModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId(userId) });

    const { initializeSocketServer } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const connectionHandler = (serverInstances[0].on.mock.calls as [
      string,
      (...args: any[]) => void
    ][]).find(([event]) => event === 'connection')?.[1] as (socket: any) => void;

    const socket: any = {
      id: 'socket-test',
      data: { user: { userId } },
      handshake: { auth: {}, query: {}, headers: {} },
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
    };

    connectionHandler(socket);

    return { socket, userId };
  };

  // API: emitCatalogEntriesUpdated
  // Input: called before socket server initialized
  // Expected status code: n/a
  // Expected behavior: logs warning and does not throw
  // Expected output: logger.warn invoked with skip message
  test('emitCatalogEntriesUpdated warns when server not initialized', () => {
    const { emitCatalogEntriesUpdated } = loadSocketModule();

    emitCatalogEntriesUpdated(new mongoose.Types.ObjectId(), [], new mongoose.Types.ObjectId());

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Socket.IO server not initialized. Skipping emit.',
      expect.objectContaining({ event: 'catalog:entries-updated' })
    );
  });

  // API: initializeSocketServer
  // Input: two invocations with different http servers
  // Expected behavior: reuses existing socket server instance
  // Expected output: Server constructor called once, returned instance reused
  test('initializeSocketServer reuses existing server instance', () => {
    process.env.JWT_SECRET = 'secret';
    jwtVerifyMock.mockReturnValue({ id: new mongoose.Types.ObjectId().toString() });
    mockUserModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

    const { initializeSocketServer } = loadSocketModule();

    const first = initializeSocketServer({} as http.Server);
    const second = initializeSocketServer({} as http.Server);

    expect(first).toBe(second);
    expect(ServerConstructor).toHaveBeenCalledTimes(1);
  });

  // API: socket authentication middleware
  // Input: DISABLE_AUTH true with valid TEST_USER_ID
  // Expected behavior: assigns user to socket and calls next without error
  // Expected output: socket.data.user.userId equals TEST_USER_ID
  test('auth middleware injects fallback user when DISABLE_AUTH enabled', async () => {
    process.env.DISABLE_AUTH = 'true';
    const fallbackId = new mongoose.Types.ObjectId().toString();
    process.env.TEST_USER_ID = fallbackId;

    const { initializeSocketServer } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const middleware = serverInstances[0].use.mock.calls[0][0] as (
      socket: any,
      next: (err?: Error) => void
    ) => Promise<void>;
    const socket: any = { data: {}, handshake: {} };
    const next = jest.fn();

    await middleware(socket, next);

    expect(socket.data.user?.userId).toBe(fallbackId);
    expect(next).toHaveBeenCalledWith();
  });

  // API: socket authentication middleware
  // Input: DISABLE_AUTH true without TEST_USER_ID
  // Expected behavior: warns and rejects connection
  // Expected output: next called with Error('Unauthorized')
  test('auth middleware rejects when fallback user missing', async () => {
    process.env.DISABLE_AUTH = 'true';

    const { initializeSocketServer } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const middleware = serverInstances[0].use.mock.calls[0][0] as (
      socket: any,
      next: (err?: Error) => void
    ) => Promise<void>;
    const socket: any = { data: {}, handshake: {} };
    const next = jest.fn();

    await middleware(socket, next);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Socket authentication disabled but TEST_USER_ID is not configured. Connection denied.'
    );
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  // API: socket authentication middleware
  // Input: JWT token with valid user id
  // Expected behavior: loads user and attaches to socket
  // Expected output: socket.data.user populated and next called
  test('auth middleware validates JWT and user identity', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    process.env.JWT_SECRET = 'secret';
    jwtVerifyMock.mockReturnValue({ id: userId });
    mockUserModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId(userId) });

    const { initializeSocketServer } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const middleware = serverInstances[0].use.mock.calls[0][0] as (
      socket: any,
      next: (err?: Error) => void
    ) => Promise<void>;
    const socket: any = {
      data: {},
      handshake: { auth: { token: 'jwt-token' }, query: {}, headers: {} },
    };
    const next = jest.fn();

    await middleware(socket, next);

    expect(jwtVerifyMock).toHaveBeenCalledWith('jwt-token', 'secret');
    expect(mockUserModel.findById).toHaveBeenCalled();
    expect(socket.data.user?.userId).toBeDefined();
    expect(next).toHaveBeenCalledWith();
  });

  // API: 'catalog:join' handler
  // Input: valid catalog id owned by the authenticated user
  // Expected behavior: joins room and acknowledges success
  // Expected output: socket.join called with room name; ack receives { ok: true }
  test('catalog:join joins room when user owns catalog', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    process.env.JWT_SECRET = 'secret';
    jwtVerifyMock.mockReturnValue({ id: userId });
    mockUserModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId(userId) });

    const { initializeSocketServer } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const connectionHandler = (serverInstances[0].on.mock.calls as [
      string,
      (...args: any[]) => void
    ][]).find(([event]) => event === 'connection')?.[1] as (socket: any) => void;

    const socket: any = {
      id: 'socket-1',
      data: { user: { userId } },
      handshake: { auth: {}, query: {}, headers: {} },
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
    };

    connectionHandler(socket);

    const joinHandler = (socket.on.mock.calls as [string, (...args: any[]) => void][])
      .find(([event]) => event === 'catalog:join')?.[1] as (
      catalogId: string,
      ack?: (response: any) => void
    ) => Promise<void>;

    const catalogId = new mongoose.Types.ObjectId().toString();
    mockCatalogModel.findById.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(catalogId),
      owner: new mongoose.Types.ObjectId(userId),
    });
    mockCatalogShareModel.getUserAccess.mockResolvedValueOnce(null);

    const ack = jest.fn();
    await joinHandler(catalogId, ack);

    expect(socket.join).toHaveBeenCalledWith(`catalog:${catalogId}`);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  // API: 'catalog:join' handler
  // Input: missing catalogId parameter
  // Expected status code: n/a
  // Expected behavior: acknowledges error without hitting database
  // Expected output: ack payload { ok: false, error: 'Catalog ID is required' }
  test('catalog:join rejects when catalog id missing', async () => {
    const { socket } = initializeConnectedSocket();
    const joinHandler = (socket.on.mock.calls as [string, (...args: any[]) => void][])
      .find(([event]) => event === 'catalog:join')?.[1] as (
      catalogId: string,
      ack?: (response: any) => void
    ) => Promise<void>;

    const ack = jest.fn();
    await joinHandler('', ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'Catalog ID is required' });
    expect(mockCatalogModel.findById).not.toHaveBeenCalled();
  });

  // API: 'catalog:join' handler
  // Input: catalog id where user lacks ownership and share access
  // Expected status code: n/a
  // Expected behavior: acknowledges access denied
  // Expected output: { ok: false, error: 'Access denied' }
  test('catalog:join denies access for unauthorized users', async () => {
    const { socket } = initializeConnectedSocket();
    const joinHandler = (socket.on.mock.calls as [string, (...args: any[]) => void][])
      .find(([event]) => event === 'catalog:join')?.[1] as (
      catalogId: string,
      ack?: (response: any) => void
    ) => Promise<void>;

    const catalogId = new mongoose.Types.ObjectId().toString();
    mockCatalogModel.findById.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(catalogId),
      owner: new mongoose.Types.ObjectId(),
    });
    mockCatalogShareModel.getUserAccess.mockResolvedValueOnce(null);

    const ack = jest.fn();
    await joinHandler(catalogId, ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'Access denied' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  // API: 'catalog:join' handler
  // Input: catalog lookup throws error
  // Expected status code: n/a
  // Expected behavior: logs error and returns generic failure ack
  // Expected output: { ok: false, error: 'Failed to join catalog room' }
  test('catalog:join handles unexpected errors gracefully', async () => {
    const { socket } = initializeConnectedSocket();
    const joinHandler = (socket.on.mock.calls as [string, (...args: any[]) => void][])
      .find(([event]) => event === 'catalog:join')?.[1] as (
      catalogId: string,
      ack?: (response: any) => void
    ) => Promise<void>;

    const catalogId = new mongoose.Types.ObjectId().toString();
    const failure = new Error('db failure');
    mockCatalogModel.findById.mockRejectedValueOnce(failure);

    const ack = jest.fn();
    await joinHandler(catalogId, ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'Failed to join catalog room' });
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to join catalog room', {
      userId: expect.any(String),
      catalogId,
      error: failure,
    });
  });

  // API: 'catalog:join' handler
  // Input: invalid catalog id string
  // Expected behavior: rejects request with error ack
  // Expected output: ack called with { ok: false, error: 'Invalid catalog ID' }
  test('catalog:join rejects invalid catalog ids', async () => {
    const { initializeSocketServer } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const connectionHandler = (serverInstances[0].on.mock.calls as [
      string,
      (...args: any[]) => void
    ][]).find(([event]) => event === 'connection')?.[1] as (socket: any) => void;

    const socket: any = {
      data: { user: { userId: new mongoose.Types.ObjectId().toString() } },
      handshake: { auth: {}, query: {}, headers: {} },
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
    };

    connectionHandler(socket);

    const joinHandler = (socket.on.mock.calls as [string, (...args: any[]) => void][])
      .find(([event]) => event === 'catalog:join')?.[1] as (
      catalogId: string,
      ack?: (response: any) => void
    ) => Promise<void>;

    const ack = jest.fn();
    await joinHandler('invalid-id', ack);

    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'Invalid catalog ID' });
  });

  // API: 'catalog:leave' handler
  // Input: valid catalog ObjectId string
  // Expected status code: n/a
  // Expected behavior: socket leaves corresponding room
  // Expected output: socket.leave invoked with catalog room name
  test('catalog:leave removes socket from room', () => {
    const { socket } = initializeConnectedSocket();
    const leaveHandler = (socket.on.mock.calls as [string, (...args: any[]) => void][])
      .find(([event]) => event === 'catalog:leave')?.[1] as (catalogId: string) => void;

    const catalogId = new mongoose.Types.ObjectId().toString();
    leaveHandler(catalogId);

    expect(socket.leave).toHaveBeenCalledWith(`catalog:${catalogId}`);
  });

  // API: emitCatalogEntriesUpdated
  // Input: initialized server and payload
  // Expected behavior: emits to the correct room with normalized payload
  // Expected output: room emit invoked with event name and payload containing catalogId string
  test('emitCatalogEntriesUpdated emits via Socket.IO when initialized', () => {
    process.env.JWT_SECRET = 'secret';
    jwtVerifyMock.mockReturnValue({ id: new mongoose.Types.ObjectId().toString() });
    mockUserModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

    const { initializeSocketServer, emitCatalogEntriesUpdated } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const catalogId = new mongoose.Types.ObjectId();
    emitCatalogEntriesUpdated(catalogId, [], new mongoose.Types.ObjectId());

    expect(serverInstances[0].to).toHaveBeenCalledWith(`catalog:${catalogId.toString()}`);
    expect((serverInstances[0] as any).__roomEmit).toHaveBeenCalledWith(
      'catalog:entries-updated',
      expect.objectContaining({ catalogId: catalogId.toString() })
    );
  });

  // API: emitCatalogMetadataUpdated
  // Input: initialized server and catalog payload
  // Expected status code: n/a
  // Expected behavior: emits metadata-updated event with catalog snapshot
  // Expected output: Socket emit called with event and payload containing catalogId
  test('emitCatalogMetadataUpdated broadcasts catalog metadata changes', () => {
    process.env.JWT_SECRET = 'secret';
    jwtVerifyMock.mockReturnValue({ id: new mongoose.Types.ObjectId().toString() });
    mockUserModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

    const { initializeSocketServer, emitCatalogMetadataUpdated } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const catalog = { _id: new mongoose.Types.ObjectId(), title: 'Demo' } as unknown as ICatalog;
    emitCatalogMetadataUpdated(catalog, new mongoose.Types.ObjectId());

    expect(serverInstances[0].to).toHaveBeenCalledWith(`catalog:${catalog._id.toString()}`);
    expect((serverInstances[0] as any).__roomEmit).toHaveBeenCalledWith(
      'catalog:metadata-updated',
      expect.objectContaining({
        catalogId: catalog._id.toString(),
        catalog: expect.objectContaining({ title: 'Demo' }),
      })
    );
  });

  // API: emitCatalogDeleted
  // Input: initialized server and catalogId
  // Expected status code: n/a
  // Expected behavior: emits catalog:deleted event with id and timestamp
  // Expected output: emit called with payload containing catalogId
  test('emitCatalogDeleted notifies subscribers', () => {
    process.env.JWT_SECRET = 'secret';
    jwtVerifyMock.mockReturnValue({ id: new mongoose.Types.ObjectId().toString() });
    mockUserModel.findById.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

    const { initializeSocketServer, emitCatalogDeleted } = loadSocketModule();
    initializeSocketServer({} as http.Server);

    const catalogId = new mongoose.Types.ObjectId();
    emitCatalogDeleted(catalogId, new mongoose.Types.ObjectId());

    expect(serverInstances[0].to).toHaveBeenCalledWith(`catalog:${catalogId.toString()}`);
    expect((serverInstances[0] as any).__roomEmit).toHaveBeenCalledWith(
      'catalog:deleted',
      expect.objectContaining({ catalogId: catalogId.toString() })
    );
  });
});
