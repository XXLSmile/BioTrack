import mongoose, { Document } from 'mongoose';
import z from 'zod';
import { ICatalogEntry } from '../recognition/catalog.model';

export interface ICatalog extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const createCatalogSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Catalog name cannot be empty')
    .max(100, 'Catalog name must be at most 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
});

export const updateCatalogSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Catalog name cannot be empty')
      .max(100, 'Catalog name must be at most 100 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be at most 500 characters')
      .optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update the catalog',
  });

export type CreateCatalogRequest = z.infer<typeof createCatalogSchema>;
export type UpdateCatalogRequest = z.infer<typeof updateCatalogSchema>;

export type CatalogResponse = {
  message: string;
  data?: {
    catalog: ICatalog;
    entries?: CatalogEntryLinkResponse[];
  };
};

export type CatalogListResponse = {
  message: string;
  data?: {
    catalogs: ICatalog[];
  };
};

export type CatalogEntryLinkResponse = {
  entry: ICatalogEntry;
  linkedAt: Date;
  addedBy: mongoose.Types.ObjectId;
};
