import mongoose, { Schema, Document } from 'mongoose';

// Catalog entry interface (represents a user's saved wildlife sighting)
export interface ICatalogEntry extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  speciesId: mongoose.Types.ObjectId;
  imageUrl: string;
  latitude?: number;
  longitude?: number;
  confidence: number;
  notes?: string;
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
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
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
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
catalogSchema.index({ userId: 1, createdAt: -1 });
catalogSchema.index({ speciesId: 1, createdAt: -1 });

export const CatalogModel = mongoose.model<ICatalogEntry>('CatalogEntry', catalogSchema);

// Catalog Repository
export class CatalogRepository {
  async create(data: {
    userId: string;
    speciesId: string;
    imageUrl: string;
    latitude?: number;
    longitude?: number;
    confidence: number;
    notes?: string;
  }): Promise<ICatalogEntry> {
    const catalogEntry = await CatalogModel.create(data);
    return catalogEntry;
  }

  async findByUserId(userId: string, limit: number = 50): Promise<ICatalogEntry[]> {
    return await CatalogModel.find({ userId })
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
}

export const catalogRepository = new CatalogRepository();

