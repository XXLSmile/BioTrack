import mongoose, { Document } from 'mongoose';
import z from 'zod';

// Catalog entry subdocument
// ------------------------------------------------------------
export type CatalogLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type CatalogEntry = {
  _id: mongoose.Types.ObjectId;
  speciesName: string;
  description?: string;
  notes?: string;
  imageUrl?: string;
  observedAt?: Date;
  location?: CatalogLocation;
  createdAt: Date;
  updatedAt: Date;
};

export interface ICatalog extends Document {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  entries: CatalogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// Zod schemas
// ------------------------------------------------------------
export const locationSchema = z.object({
  latitude: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be >= -180')
    .max(180, 'Longitude must be <= 180'),
  label: z.string().trim().max(200, 'Location label must be at most 200 characters').optional(),
});

export const createCatalogSchema = z.object({
  name: z.string().trim().min(1, 'Catalog name cannot be empty').max(100, 'Catalog name must be at most 100 characters'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
});

export const updateCatalogSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Catalog name cannot be empty')
      .max(100, 'Catalog name must be at most 100 characters')
      .optional(),
    description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update the catalog',
  });

export const addCatalogEntrySchema = z.object({
  speciesName: z.string().trim().min(1, 'Species name cannot be empty').max(120, 'Species name must be at most 120 characters'),
  description: z.string().trim().max(1000, 'Description must be at most 1000 characters').optional(),
  notes: z.string().trim().max(1000, 'Notes must be at most 1000 characters').optional(),
  imageUrl: z.string().url('Image URL must be a valid URL').optional(),
  observedAt: z.coerce.date().optional(),
  location: locationSchema.optional(),
});

export const updateCatalogEntrySchema = addCatalogEntrySchema.partial().refine(
  data => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided to update the catalog entry',
  }
);

// Request types
// ------------------------------------------------------------
export type CreateCatalogRequest = z.infer<typeof createCatalogSchema>;
export type UpdateCatalogRequest = z.infer<typeof updateCatalogSchema>;
export type AddCatalogEntryRequest = z.infer<typeof addCatalogEntrySchema>;
export type UpdateCatalogEntryRequest = z.infer<typeof updateCatalogEntrySchema>;

export type CatalogResponse = {
  message: string;
  data?: {
    catalog: ICatalog;
  };
};

export type CatalogListResponse = {
  message: string;
  data?: {
    catalogs: ICatalog[];
  };
};

export type CatalogEntryResponse = {
  message: string;
  data?: {
    catalog: ICatalog;
  };
};
