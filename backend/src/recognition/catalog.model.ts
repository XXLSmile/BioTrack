import mongoose, { Schema, Document } from 'mongoose';
import fs from 'fs';
import path from 'path';

import { catalogEntryLinkModel } from '../catalog/catalogEntryLink.model';
import logger from '../logger.util';
import { userModel } from '../user/user.model';
import { ensurePathWithinRoot, resolveWithinRoot } from '../utils/pathSafe';

// Catalog entry interface (represents a user's saved wildlife sighting)
export interface ICatalogEntry extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  speciesId: mongoose.Types.ObjectId;
  imageUrl: string;
  imageData?: Buffer; // Store the actual image data
  imageMimeType?: string; // Store the image type (e.g., 'image/jpeg')
  latitude?: number;
  longitude?: number;
  city?: string;
  province?: string;
  confidence: number;
  notes?: string;
  imageHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const catalogSchema = new Schema<ICatalogEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    speciesId: {
      type: Schema.Types.ObjectId,
      ref: 'Species',
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageData: {
      type: Buffer,
      required: false,
    },
    imageMimeType: {
      type: String,
      required: false,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    city: {
      type: String,
      trim: true,
    },
    province: {
      type: String,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    imageHash: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
catalogSchema.index({ userId: 1, createdAt: -1 });
catalogSchema.index({ speciesId: 1, createdAt: -1 });
catalogSchema.index({ userId: 1, imageHash: 1 }, { unique: true });

export const CatalogModel = mongoose.model<ICatalogEntry>('CatalogEntry', catalogSchema);

// Catalog Repository
const UPLOADS_ROOT = path.resolve(path.join(__dirname, '../../uploads'));
const IMAGES_ROOT = resolveWithinRoot(UPLOADS_ROOT, 'images');

export class CatalogRepository {
  async create(data: {
    userId: string;
    speciesId: string;
    imageUrl: string;
    imageData?: Buffer;
    imageMimeType?: string;
    latitude?: number;
    longitude?: number;
    city?: string;
    province?: string;
    confidence: number;
    notes?: string;
    imageHash: string;
  }): Promise<ICatalogEntry> {
    const catalogEntry = await CatalogModel.create(data);
    return catalogEntry;
  }

  async findByHash(
    userId: string,
    imageHash: string
  ): Promise<ICatalogEntry | null> {
    return CatalogModel.findOne({ userId, imageHash });
  }

  async findById(entryId: string): Promise<ICatalogEntry | null> {
    if (!mongoose.Types.ObjectId.isValid(entryId)) {
      return null;
    }
    return await CatalogModel.findById(entryId).populate('speciesId');
  }

  async findByUserId(userId: string, limit: number = 50): Promise<ICatalogEntry[]> {
    return await CatalogModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('speciesId');
  }

  async findRecentByUserId(userId: string, limit: number = 10): Promise<ICatalogEntry[]> {
    return CatalogModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('speciesId');
  }

  async countByUserId(userId: string): Promise<number> {
    return await CatalogModel.countDocuments({ userId });
  }

  async countUniqueSpeciesByUserId(userId: string): Promise<number> {
    const unique = await CatalogModel.distinct('speciesId', { userId });
    return unique.length;
  }

  async deleteById(
    entryId: string,
    userId: string
  ): Promise<'deleted' | 'not_found' | 'forbidden'> {
    if (!mongoose.Types.ObjectId.isValid(entryId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return 'not_found';
    }

    const entry = await CatalogModel.findById(entryId);
    if (!entry) {
      return 'not_found';
    }

    const ownerId = entry.userId instanceof mongoose.Types.ObjectId
      ? entry.userId
      : new mongoose.Types.ObjectId(entry.userId);

    if (!ownerId.equals(new mongoose.Types.ObjectId(userId))) {
      return 'forbidden';
    }

    try {
      await catalogEntryLinkModel.removeEntryFromAllCatalogs(entry._id);

      if (entry.imageUrl) {
        const filename = path.basename(entry.imageUrl);
        const filepath = ensurePathWithinRoot(IMAGES_ROOT, path.join(IMAGES_ROOT, filename));
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }

      await entry.deleteOne();
      await userModel.recomputeObservationCount(ownerId);
      return 'deleted';
    } catch (error) {
      logger.error('Failed to delete catalog entry', {
        entryId,
        error,
      });
      throw error;
    }
  }
}

export const catalogRepository = new CatalogRepository();
