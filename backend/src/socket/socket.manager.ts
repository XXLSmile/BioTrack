import http from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import logger from '../logger.util';
import { userModel } from '../user/user.model';
import { catalogModel } from '../catalog/catalog.model';
import { catalogShareModel } from '../catalog/catalogShare.model';
import { CatalogEntryLinkResponse, ICatalog } from '../catalog/catalog.types';

type SocketAuthPayload = {
  id: string;
};

type SocketUserData = {
  userId: string;
};

type CatalogSocketAck = {
  ok: boolean;
  error?: string;
};

export type CatalogEntriesEventPayload = {
  catalogId: string;
  entries: unknown[];
  triggeredBy: string;
  updatedAt: string;
};

export type CatalogUpdatedEventPayload = {
  catalogId: string;
  catalog: Record<string, unknown>;
  triggeredBy: string;
  updatedAt: string;
};

export type CatalogDeletedEventPayload = {
  catalogId: string;
  triggeredBy: string;
  timestamp: string;
};

let io: Server | null = null;

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

const extractToken = (socket: Socket): string | undefined => {
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

export const initializeSocketServer = (server: http.Server): Server => {
  if (io) {
    return io;
  }

  io = new Server(server, {
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
          } satisfies SocketUserData;
          return next();
        }

        logger.warn('Socket authentication disabled but TEST_USER_ID is not configured. Connection denied.');
        return next(new Error('Unauthorized'));
      }

      const token = extractToken(socket);
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        logger.error('JWT_SECRET is not configured. Socket authentication cannot proceed.');
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, secret) as SocketAuthPayload;
      if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
        return next(new Error('Unauthorized'));
      }

      const user = await userModel.findById(new mongoose.Types.ObjectId(decoded.id));
      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.data.user = {
        userId: user._id.toString(),
      } satisfies SocketUserData;

      next();
    } catch (error) {
      logger.warn('Socket authentication failed', { error });
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', socket => {
    const userData = socket.data.user as SocketUserData | undefined;
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

const getServer = (): Server | null => io;

const emitToCatalogRoom = (catalogId: mongoose.Types.ObjectId | string, event: string, payload: unknown): void => {
  const server = getServer();
  if (!server) {
    logger.warn('Socket.IO server not initialized. Skipping emit.', {
      event,
      catalogId: catalogId.toString(),
    });
    return;
  }

  server.to(buildCatalogRoom(catalogId.toString())).emit(event, payload);
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
