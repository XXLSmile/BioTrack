import { Router } from 'express';

import {
  AddCatalogEntryRequest,
  CreateCatalogRequest,
  UpdateCatalogEntryRequest,
  UpdateCatalogRequest,
  addCatalogEntrySchema,
  createCatalogSchema,
  updateCatalogEntrySchema,
  updateCatalogSchema,
} from './catalog.types';
import { CatalogController } from './catalog.controller';
import { validateBody } from '../validation.middleware';

const router = Router();
const catalogController = new CatalogController();

router.get('/', catalogController.listCatalogs);
router.post(
  '/',
  validateBody<CreateCatalogRequest>(createCatalogSchema),
  catalogController.createCatalog
);

router.get(
  '/:catalogId',
  catalogController.getCatalogById
);
router.patch(
  '/:catalogId',
  validateBody<UpdateCatalogRequest>(updateCatalogSchema),
  catalogController.updateCatalog
);
router.delete(
  '/:catalogId',
  catalogController.deleteCatalog
);

router.post(
  '/:catalogId/entries',
  validateBody<AddCatalogEntryRequest>(addCatalogEntrySchema),
  catalogController.addCatalogEntry
);
router.patch(
  '/:catalogId/entries/:entryId',
  validateBody<UpdateCatalogEntryRequest>(updateCatalogEntrySchema),
  catalogController.updateCatalogEntry
);
router.delete(
  '/:catalogId/entries/:entryId',
  catalogController.removeCatalogEntry
);

export default router;
