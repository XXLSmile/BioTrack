import { Router } from 'express';

import {
  CreateCatalogRequest,
  UpdateCatalogRequest,
  createCatalogSchema,
  updateCatalogSchema,
} from './catalog.types';
import { CatalogController } from './catalog.controller';
import { catalogShareController } from './catalogShare.controller';
import {
  inviteCollaboratorSchema,
  respondToInvitationSchema,
  updateCollaboratorSchema,
  InviteCollaboratorRequest,
  RespondToInvitationRequest,
  UpdateCollaboratorRequest,
} from './catalogShare.types';
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
  '/shared-with/me',
  catalogShareController.listSharedWithMe.bind(catalogShareController)
);

router.patch(
  '/share/:shareId/respond',
  validateBody<RespondToInvitationRequest>(respondToInvitationSchema),
  catalogShareController.respondToInvitation.bind(catalogShareController)
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
  '/:catalogId/entries/:entryId',
  catalogController.linkCatalogEntry.bind(catalogController)
);
router.delete(
  '/:catalogId/entries/:entryId',
  catalogController.unlinkCatalogEntry.bind(catalogController)
);

router.get(
  '/:catalogId/share',
  catalogShareController.listCollaborators.bind(catalogShareController)
);

router.post(
  '/:catalogId/share',
  validateBody<InviteCollaboratorRequest>(inviteCollaboratorSchema),
  catalogShareController.inviteCollaborator.bind(catalogShareController)
);

router.patch(
  '/:catalogId/share/:shareId',
  validateBody<UpdateCollaboratorRequest>(updateCollaboratorSchema),
  catalogShareController.updateCollaborator.bind(catalogShareController)
);

export default router;
