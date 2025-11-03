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
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const catalogController = new CatalogController();

router.get('/', asyncHandler(catalogController.listCatalogs.bind(catalogController)));
router.post(
  '/',
  validateBody<CreateCatalogRequest>(createCatalogSchema),
  asyncHandler(catalogController.createCatalog.bind(catalogController))
);

router.get(
  '/shared-with/me',
  asyncHandler(catalogShareController.listSharedWithMe.bind(catalogShareController))
);

router.get(
  '/share/pending',
  asyncHandler(catalogShareController.listPendingInvitations.bind(catalogShareController))
);

router.patch(
  '/share/:shareId/respond',
  validateBody<RespondToInvitationRequest>(respondToInvitationSchema),
  asyncHandler(catalogShareController.respondToInvitation.bind(catalogShareController))
);

router.get(
  '/:catalogId',
  asyncHandler(catalogController.getCatalogById.bind(catalogController))
);
router.patch(
  '/:catalogId',
  validateBody<UpdateCatalogRequest>(updateCatalogSchema),
  asyncHandler(catalogController.updateCatalog.bind(catalogController))
);
router.delete(
  '/:catalogId',
  asyncHandler(catalogController.deleteCatalog.bind(catalogController))
);

router.post(
  '/:catalogId/entries/:entryId',
  asyncHandler(catalogController.linkCatalogEntry.bind(catalogController))
);
router.delete(
  '/:catalogId/entries/:entryId',
  asyncHandler(catalogController.unlinkCatalogEntry.bind(catalogController))
);

router.get(
  '/:catalogId/share',
  asyncHandler(catalogShareController.listCollaborators.bind(catalogShareController))
);

router.post(
  '/:catalogId/share',
  validateBody<InviteCollaboratorRequest>(inviteCollaboratorSchema),
  asyncHandler(catalogShareController.inviteCollaborator.bind(catalogShareController))
);

router.patch(
  '/:catalogId/share/:shareId',
  validateBody<UpdateCollaboratorRequest>(updateCollaboratorSchema),
  asyncHandler(catalogShareController.updateCollaborator.bind(catalogShareController))
);

export default router;
