import mongoose, { Schema } from 'mongoose';

import {
  AddCatalogEntryRequest,
  CatalogEntry,
  ICatalog,
  UpdateCatalogEntryRequest,
  UpdateCatalogRequest,
} from './catalog.types';

const locationSchema = new Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      required: true,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      required: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false }
);

const catalogEntrySchema = new Schema<CatalogEntry>(
  {
    speciesName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    observedAt: {
      type: Date,
    },
    location: {
      type: locationSchema,
    },
  },
  {
    timestamps: true,
  }
);

const catalogSchema = new Schema<ICatalog>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    entries: {
      type: [catalogEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

catalogSchema.index({ owner: 1, name: 1 }, { unique: true });

export class CatalogModel {
  private catalog: mongoose.Model<ICatalog>;

  constructor() {
    this.catalog = mongoose.model<ICatalog>('Catalog', catalogSchema);
  }

  async createCatalog(
    owner: mongoose.Types.ObjectId,
    payload: { name: string; description?: string }
  ): Promise<ICatalog> {
    return this.catalog.create({
      owner,
      name: payload.name,
      description: payload.description,
    });
  }

  async findCatalogById(
    catalogId: string,
    owner: mongoose.Types.ObjectId
  ): Promise<ICatalog | null> {
    if (!mongoose.Types.ObjectId.isValid(catalogId)) {
      return null;
    }

    return this.catalog.findOne({
      _id: catalogId,
      owner,
    });
  }

  async listCatalogs(owner: mongoose.Types.ObjectId): Promise<ICatalog[]> {
    return this.catalog
      .find({ owner })
      .sort({ updatedAt: -1, createdAt: -1 })
      .exec();
  }

  async updateCatalog(
    catalogId: string,
    owner: mongoose.Types.ObjectId,
    payload: UpdateCatalogRequest
  ): Promise<ICatalog | null> {
    if (!mongoose.Types.ObjectId.isValid(catalogId)) {
      return null;
    }

    return this.catalog.findOneAndUpdate(
      {
        _id: catalogId,
        owner,
      },
      {
        $set: payload,
      },
      {
        new: true,
      }
    );
  }

  async deleteCatalog(
    catalogId: string,
    owner: mongoose.Types.ObjectId
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(catalogId)) {
      return false;
    }

    const result = await this.catalog.deleteOne({
      _id: catalogId,
      owner,
    });

    return result.deletedCount === 1;
  }

  async addEntry(
    catalogId: string,
    owner: mongoose.Types.ObjectId,
    payload: AddCatalogEntryRequest
  ): Promise<ICatalog | null> {
    if (!mongoose.Types.ObjectId.isValid(catalogId)) {
      return null;
    }

    return this.catalog.findOneAndUpdate(
      {
        _id: catalogId,
        owner,
      },
      {
        $push: {
          entries: {
            speciesName: payload.speciesName,
            description: payload.description,
            notes: payload.notes,
            imageUrl: payload.imageUrl,
            observedAt: payload.observedAt,
            location: payload.location,
          },
        },
      },
      {
        new: true,
      }
    );
  }

  async updateEntry(
    catalogId: string,
    entryId: string,
    owner: mongoose.Types.ObjectId,
    payload: UpdateCatalogEntryRequest
  ): Promise<ICatalog | null> {
    if (
      !mongoose.Types.ObjectId.isValid(catalogId) ||
      !mongoose.Types.ObjectId.isValid(entryId)
    ) {
      return null;
    }

    const update: Record<string, unknown> = {};
    if (payload.speciesName !== undefined) {
      update['entries.$.speciesName'] = payload.speciesName;
    }
    if (payload.description !== undefined) {
      update['entries.$.description'] = payload.description;
    }
    if (payload.notes !== undefined) {
      update['entries.$.notes'] = payload.notes;
    }
    if (payload.imageUrl !== undefined) {
      update['entries.$.imageUrl'] = payload.imageUrl;
    }
    if (payload.observedAt !== undefined) {
      update['entries.$.observedAt'] = payload.observedAt;
    }
    if (payload.location !== undefined) {
      update['entries.$.location'] = payload.location;
    }

    return this.catalog.findOneAndUpdate(
      {
        _id: catalogId,
        owner,
        'entries._id': entryId,
      },
      {
        $set: update,
      },
      {
        new: true,
      }
    );
  }

  async removeEntry(
    catalogId: string,
    entryId: string,
    owner: mongoose.Types.ObjectId
  ): Promise<ICatalog | null> {
    if (
      !mongoose.Types.ObjectId.isValid(catalogId) ||
      !mongoose.Types.ObjectId.isValid(entryId)
    ) {
      return null;
    }

    return this.catalog.findOneAndUpdate(
      {
        _id: catalogId,
        owner,
      },
      {
        $pull: {
          entries: {
            _id: entryId,
          },
        },
      },
      {
        new: true,
      }
    );
  }
}

export const catalogModel = new CatalogModel();
