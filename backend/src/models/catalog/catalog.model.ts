import mongoose, { Schema } from 'mongoose';

import { ICatalog, UpdateCatalogRequest } from '../../types/catalog.types';

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

  async findById(catalogId: string): Promise<ICatalog | null> {
    if (!mongoose.Types.ObjectId.isValid(catalogId)) {
      return null;
    }

    return this.catalog.findById(catalogId);
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

  async deleteAllOwnedByUser(owner: mongoose.Types.ObjectId): Promise<number> {
    const result = await this.catalog.deleteMany({ owner });
    return result.deletedCount ?? 0;
  }

}

export const catalogModel = new CatalogModel();
