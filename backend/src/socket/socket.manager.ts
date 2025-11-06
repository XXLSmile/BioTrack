import http from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import logger from '../logger.util';
import { userModel } from '../user/user.model';
import { catalogModel } from '../catalog/catalog.model';
import { catalogShareModel } from '../catalog/catalogShare.model';
import { CatalogEntryLinkResponse, ICatalog } from '../catalog/catalog.types';

interface SocketUserData {
  userId: string;
}

interface CatalogSocketAck {
  ok: boolean;
  error?: string;
}

type ClientToServerEvents = {
  'catalog:join': (catalogId: string, ack?: (response: CatalogSocketAck) => void) => void;
  'catalog:leave': (catalogId: string) => void;
};

type ServerToClientEvents = {
  'catalog:entries-updated': (payload: CatalogEntriesEventPayload) => void;
  'catalog:metadata-updated': (payload: CatalogUpdatedEventPayload) => void;
  'catalog:deleted': (payload: CatalogDeletedEventPayload) => void;
};

type InterServerEvents = Record<string, never>;

interface ServerSocketData {
  user?: SocketUserData;
}

export interface CatalogEntriesEventPayload {
  catalogId: string;
  entries: unknown[];
  triggeredBy: string;
  updatedAt: string;
}

export interface CatalogUpdatedEventPayload {
  catalogId: string;
  catalog: Record<string, unknown>;
  triggeredBy: string;
  updatedAt: string;
}

export interface CatalogDeletedEventPayload {
  catalogId: string;
  triggeredBy: string;
  timestamp: string;
}

type SocketServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, ServerSocketData>;

let io: SocketServer | null = null;

const buildCatalogRoom = (catalogId: string): string => `catalog:${catalogId}`;

const getCorsOrigins = (): string[] | string => {
  const configured = process.env.SOCKET_CORS_ORIGIN;
  if (!configured) {
    return '*';
  }

  const origins = configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : '*';
};

const extractToken = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, ServerSocketData>
): string | undefined => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
    return queryToken.trim();
  }

  const headerAuth = socket.handshake.headers?.authorization;
  if (typeof headerAuth === 'string' && headerAuth.startsWith('Bearer ')) {
    return headerAuth.substring('Bearer '.length).trim();
  }

  return undefined;
};

const userHasCatalogAccess = async (userId: string, catalogId: string): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(catalogId)) {
    return false;
  }

  const catalog = await catalogModel.findById(catalogId);
  if (!catalog) {
    return false;
  }

  if (catalog.owner.toString() === userId) {
    return true;
  }

  const catalogObjectId = new mongoose.Types.ObjectId(catalogId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const share = await catalogShareModel.getUserAccess(catalogObjectId, userObjectId);
  return !!share;
};

export const initializeSocketServer = (
  server: http.Server
): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, ServerSocketData> => {
  if (io) {
    return io;
  }

  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, ServerSocketData>(server, {
    cors: {
      origin: getCorsOrigins(),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      if (process.env.DISABLE_AUTH === 'true') {
        const fallbackUserId = process.env.TEST_USER_ID;
        if (fallbackUserId && mongoose.Types.ObjectId.isValid(fallbackUserId)) {
          socket.data.user = {
            userId: fallbackUserId,
          };
          next();
          return;
        }

        logger.warn('Socket authentication disabled but TEST_USER_ID is not configured. Connection denied.');
        next(new Error('Unauthorized'));
        return;
      }

      const token = extractToken(socket);
      if (!token) {
        next(new Error('Unauthorized'));
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        logger.error('JWT_SECRET is not configured. Socket authentication cannot proceed.');
        next(new Error('Unauthorized'));
        return;
      }

      const decoded = jwt.verify(token, secret);
      const rawId =
        typeof decoded === 'object' && decoded !== null && 'id' in decoded
          ? (decoded as { id: unknown }).id
          : undefined;

      let userObjectId: mongoose.Types.ObjectId | undefined;

      if (typeof rawId === 'string') {
        if (!mongoose.Types.ObjectId.isValid(rawId)) {
          next(new Error('Unauthorized'));
          return;
        }
        userObjectId = new mongoose.Types.ObjectId(rawId);
      } else if (rawId instanceof mongoose.Types.ObjectId) {
        userObjectId = rawId;
      } else {
        next(new Error('Unauthorized'));
        return;
      }

      const user = await userModel.findById(userObjectId);
      if (!user) {
        next(new Error('Unauthorized'));
        return;
      }

      socket.data.user = {
        userId: user._id.toString(),
      };

      next();
    } catch (error) {
      logger.warn('Socket authentication failed', { error });
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', socket => {
    const userData = socket.data.user;
    const userId = userData?.userId;

    if (!userId) {
      logger.warn('Socket connected without user data. Disconnecting.');
      socket.disconnect(true);
      return;
    }

    logger.info('Socket connected', { socketId: socket.id, userId });

    socket.on('catalog:join', async (catalogId: string, ack?: (response: CatalogSocketAck) => void) => {
      try {
        if (!catalogId) {
          ack?.({ ok: false, error: 'Catalog ID is required' });
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(catalogId)) {
          ack?.({ ok: false, error: 'Invalid catalog ID' });
          return;
        }

        const hasAccess = await userHasCatalogAccess(userId, catalogId);
        if (!hasAccess) {
          ack?.({ ok: false, error: 'Access denied' });
          return;
        }

        socket.join(buildCatalogRoom(catalogId));
        ack?.({ ok: true });
      } catch (error) {
        logger.error('Failed to join catalog room', {
          userId,
          catalogId,
          error,
        });
        ack?.({ ok: false, error: 'Failed to join catalog room' });
      }
    });

    socket.on('catalog:leave', (catalogId: string) => {
      if (!catalogId || !mongoose.Types.ObjectId.isValid(catalogId)) {
        return;
      }
      socket.leave(buildCatalogRoom(catalogId));
    });

    socket.on('disconnect', reason => {
      logger.info('Socket disconnected', { socketId: socket.id, userId, reason });
    });
  });

  return io;
};

const getServer = (): SocketServer | null => io;

const emitToCatalogRoom = <TEvent extends keyof ServerToClientEvents>(
  catalogId: mongoose.Types.ObjectId | string,
  event: TEvent,
  payload: Parameters<ServerToClientEvents[TEvent]>[0]
): void => {
  const server = getServer();
  if (!server) {
    logger.warn('Socket.IO server not initialized. Skipping emit.', {
      event,
      catalogId: catalogId.toString(),
    });
    return;
  }

  const args = [payload] as Parameters<ServerToClientEvents[TEvent]>;
  server.to(buildCatalogRoom(catalogId.toString())).emit(event, ...args);
};

export const emitCatalogEntriesUpdated = (
  catalogId: mongoose.Types.ObjectId | string,
  entries: CatalogEntryLinkResponse[],
  triggeredBy: mongoose.Types.ObjectId | string
): void => {
  const payload: CatalogEntriesEventPayload = {
    catalogId: catalogId.toString(),
    entries: JSON.parse(JSON.stringify(entries)),
    triggeredBy: triggeredBy.toString(),
    updatedAt: new Date().toISOString(),
  };

  emitToCatalogRoom(catalogId, 'catalog:entries-updated', payload);
};

export const emitCatalogMetadataUpdated = (
  catalog: ICatalog,
  triggeredBy: mongoose.Types.ObjectId | string
): void => {
  const payload: CatalogUpdatedEventPayload = {
    catalogId: catalog._id.toString(),
    catalog: JSON.parse(JSON.stringify(catalog)),
    triggeredBy: triggeredBy.toString(),
    updatedAt: new Date().toISOString(),
  };

  emitToCatalogRoom(catalog._id, 'catalog:metadata-updated', payload);
};

export const emitCatalogDeleted = (
  catalogId: mongoose.Types.ObjectId | string,
  triggeredBy: mongoose.Types.ObjectId | string
): void => {
  const payload: CatalogDeletedEventPayload = {
    catalogId: catalogId.toString(),
    triggeredBy: triggeredBy.toString(),
    timestamp: new Date().toISOString(),
  };

  emitToCatalogRoom(catalogId, 'catalog:deleted', payload);
};
