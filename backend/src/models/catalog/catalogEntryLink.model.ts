import mongoose, { Schema } from 'mongoose';
import logger from '../../utils/logger.util';

export interface ICatalogEntryLink extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  catalog: mongoose.Types.ObjectId;
  entry: mongoose.Types.ObjectId;
  addedBy: mongoose.Types.ObjectId;
  addedAt: Date;
}

const catalogEntryLinkSchema = new Schema<ICatalogEntryLink>(
  {
    catalog: {
      type: Schema.Types.ObjectId,
      ref: 'Catalog',
      required: true,
      index: true,
    },
    entry: {
      type: Schema.Types.ObjectId,
      ref: 'CatalogEntry',
      required: true,
      index: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

catalogEntryLinkSchema.index({ catalog: 1, entry: 1 }, { unique: true });

export class CatalogEntryLinkModel {
  private link: mongoose.Model<ICatalogEntryLink>;

  constructor() {
    this.link = mongoose.model<ICatalogEntryLink>('CatalogEntryLink', catalogEntryLinkSchema);
  }

  async linkEntry(
    catalogId: mongoose.Types.ObjectId,
    entryId: mongoose.Types.ObjectId,
    addedBy: mongoose.Types.ObjectId
  ): Promise<ICatalogEntryLink> {
    try {
      const link = await this.link.create({
        catalog: catalogId,
        entry: entryId,
        addedBy,
      });
      return link;
    } catch (error) {
      logger.error('Failed to link entry to catalog:', error);
      throw new Error('Failed to add entry to catalog');
    }
  }

  async unlinkEntry(
    catalogId: mongoose.Types.ObjectId,
    entryId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      await this.link.deleteOne({ catalog: catalogId, entry: entryId });
    } catch (error) {
      logger.error('Failed to unlink entry from catalog:', error);
      throw new Error('Failed to remove entry from catalog');
    }
  }

  async removeEntryFromAllCatalogs(
    entryId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      await this.link.deleteMany({ entry: entryId });
    } catch (error) {
      logger.error('Failed to remove entry from catalogs:', error);
      throw new Error('Failed to remove entry from catalogs');
    }
  }

  async isEntryLinked(
    catalogId: mongoose.Types.ObjectId,
    entryId: mongoose.Types.ObjectId
  ): Promise<boolean> {
    const existing = await this.link.exists({ catalog: catalogId, entry: entryId });
    return !!existing;
  }

  async listEntriesWithDetails(
    catalogId: mongoose.Types.ObjectId
  ): Promise<ICatalogEntryLink[]> {
    return this.link
      .find({ catalog: catalogId })
      .populate({
        path: 'entry',
        populate: { path: 'speciesId' }
      })
      .populate('addedBy', 'name username profilePicture');
  }

  async listCatalogIdsForEntry(
    entryId: mongoose.Types.ObjectId
  ): Promise<mongoose.Types.ObjectId[]> {
    const catalogIds = await this.link.distinct('catalog', { entry: entryId });
    return catalogIds
      .map(id => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id))
      .filter((catalogId): catalogId is mongoose.Types.ObjectId => catalogId instanceof mongoose.Types.ObjectId);
  }
}

export const catalogEntryLinkModel = new CatalogEntryLinkModel();
