import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';

import logger from '../logger.util';
import {
  AddCatalogEntryRequest,
  CatalogListResponse,
  CatalogResponse,
  CreateCatalogRequest,
  UpdateCatalogEntryRequest,
  UpdateCatalogRequest,
} from './catalog.types';
import { catalogModel } from './catalog.model';

export class CatalogController {
  async createCatalog(
    req: Request<unknown, unknown, CreateCatalogRequest>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;

      const catalog = await catalogModel.createCatalog(user._id, req.body);

      res.status(201).json({
        message: 'Catalog created successfully',
        data: { catalog },
      });
    } catch (error) {
      logger.error('Failed to create catalog:', error);

      if (error instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
          message: 'Invalid catalog data',
        });
      }

      if ((error as { code?: number }).code === 11000) {
        return res.status(409).json({
          message: 'Catalog with the same name already exists',
        });
      }

      next(error);
    }
  }

  async listCatalogs(
    req: Request,
    res: Response<CatalogListResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;

      const catalogs = await catalogModel.listCatalogs(user._id);

      res.status(200).json({
        message: 'Catalogs fetched successfully',
        data: { catalogs },
      });
    } catch (error) {
      logger.error('Failed to fetch catalogs:', error);
      next(error);
    }
  }

  async getCatalogById(
    req: Request<{ catalogId: string }>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId } = req.params;

      const catalog = await catalogModel.findCatalogById(catalogId, user._id);

      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      res.status(200).json({
        message: 'Catalog fetched successfully',
        data: { catalog },
      });
    } catch (error) {
      logger.error('Failed to fetch catalog:', error);
      next(error);
    }
  }

  async updateCatalog(
    req: Request<{ catalogId: string }, unknown, UpdateCatalogRequest>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId } = req.params;

      const catalog = await catalogModel.updateCatalog(
        catalogId,
        user._id,
        req.body
      );

      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      res.status(200).json({
        message: 'Catalog updated successfully',
        data: { catalog },
      });
    } catch (error) {
      logger.error('Failed to update catalog:', error);

      if ((error as { code?: number }).code === 11000) {
        return res.status(409).json({
          message: 'Catalog with the same name already exists',
        });
      }

      next(error);
    }
  }

  async deleteCatalog(
    req: Request<{ catalogId: string }>,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId } = req.params;

      const deleted = await catalogModel.deleteCatalog(catalogId, user._id);

      if (!deleted) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      res.status(200).json({
        message: 'Catalog deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete catalog:', error);
      next(error);
    }
  }

  async addCatalogEntry(
    req: Request<{ catalogId: string }, unknown, AddCatalogEntryRequest>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId } = req.params;

      const catalog = await catalogModel.addEntry(
        catalogId,
        user._id,
        req.body
      );

      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog not found',
        });
      }

      res.status(200).json({
        message: 'Catalog entry added successfully',
        data: { catalog },
      });
    } catch (error) {
      logger.error('Failed to add catalog entry:', error);
      next(error);
    }
  }

  async updateCatalogEntry(
    req: Request<
      { catalogId: string; entryId: string },
      unknown,
      UpdateCatalogEntryRequest
    >,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId, entryId } = req.params;

      const catalog = await catalogModel.updateEntry(
        catalogId,
        entryId,
        user._id,
        req.body
      );

      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog entry not found',
        });
      }

      res.status(200).json({
        message: 'Catalog entry updated successfully',
        data: { catalog },
      });
    } catch (error) {
      logger.error('Failed to update catalog entry:', error);
      next(error);
    }
  }

  async removeCatalogEntry(
    req: Request<{ catalogId: string; entryId: string }>,
    res: Response<CatalogResponse>,
    next: NextFunction
  ) {
    try {
      const user = req.user!;
      const { catalogId, entryId } = req.params;

      const catalog = await catalogModel.removeEntry(
        catalogId,
        entryId,
        user._id
      );

      if (!catalog) {
        return res.status(404).json({
          message: 'Catalog entry not found',
        });
      }

      res.status(200).json({
        message: 'Catalog entry removed successfully',
        data: { catalog },
      });
    } catch (error) {
      logger.error('Failed to remove catalog entry:', error);
      next(error);
    }
  }
}
