import mongoose from 'mongoose';

import logger from '../utils/logger.util';

const handleConnectionError = (error: unknown): void => {
  logger.error('❌ MongoDB connection error:', error);
  process.exitCode = 1;
};

const handleDisconnection = (): void => {
  logger.warn('⚠️ MongoDB disconnected');
};

const handleSigint = (): void => {
  mongoose.connection
    .close()
    .then(() => {
      logger.info('MongoDB connection closed through app termination');
      process.exitCode = 0;
    })
    .catch((error: unknown) => {
      logger.error('❌ Error closing MongoDB connection:', error);
      process.exitCode = 1;
    });
};

const registerConnectionEventHandlers = (): void => {
  const connection = mongoose.connection;

  if (!connection.listeners('error').includes(handleConnectionError)) {
    connection.on('error', handleConnectionError);
  }

  if (!connection.listeners('disconnected').includes(handleDisconnection)) {
    connection.on('disconnected', handleDisconnection);
  }

  if (!process.listeners('SIGINT').includes(handleSigint)) {
    process.once('SIGINT', handleSigint);
  }
};

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not configured');
    }

    registerConnectionEventHandlers();
    await mongoose.connect(uri);

    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error);
    process.exitCode = 1;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('✅ MongoDB disconnected successfully');
  } catch (error) {
    logger.error('❌ Error disconnecting from MongoDB:', error);
  }
};
