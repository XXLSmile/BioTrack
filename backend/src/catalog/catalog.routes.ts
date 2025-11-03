import { Router } from 'express';
import type { NextFunction } from 'express';

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

const wrapController = <Req, Res>(
  fn: (req: Req, res: Res, next: NextFunction) => unknown
) => {
  return (req: Req, res: Res, next: NextFunction): void => {
    const maybePromise = fn(req, res, next);
    if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
      void (maybePromise as Promise<unknown>).catch(next);
    }
  };
};

const listCatalogs = wrapController(catalogController.listCatalogs.bind(catalogController));
const createCatalog = wrapController(catalogController.createCatalog.bind(catalogController));
const listSharedWithMe = wrapController(catalogShareController.listSharedWithMe.bind(catalogShareController));
const listPendingInvitations = wrapController(catalogShareController.listPendingInvitations.bind(catalogShareController));
const respondToInvitation = wrapController(catalogShareController.respondToInvitation.bind(catalogShareController));
const getCatalogById = wrapController(catalogController.getCatalogById.bind(catalogController));
const updateCatalog = wrapController(catalogController.updateCatalog.bind(catalogController));
const deleteCatalog = wrapController(catalogController.deleteCatalog.bind(catalogController));
const linkCatalogEntry = wrapController(catalogController.linkCatalogEntry.bind(catalogController));
const unlinkCatalogEntry = wrapController(catalogController.unlinkCatalogEntry.bind(catalogController));
const listCollaborators = wrapController(catalogShareController.listCollaborators.bind(catalogShareController));
const inviteCollaborator = wrapController(catalogShareController.inviteCollaborator.bind(catalogShareController));
const updateCollaborator = wrapController(catalogShareController.updateCollaborator.bind(catalogShareController));

router.get('/', listCatalogs);
router.post(
  '/',
  validateBody<CreateCatalogRequest>(createCatalogSchema),
  createCatalog
);

router.get(
  '/shared-with/me',
  listSharedWithMe
);

router.get(
  '/share/pending',
  listPendingInvitations
);

router.patch(
  '/share/:shareId/respond',
  validateBody<RespondToInvitationRequest>(respondToInvitationSchema),
  respondToInvitation
);

router.get(
  '/:catalogId',
  getCatalogById
);
router.patch(
  '/:catalogId',
  validateBody<UpdateCatalogRequest>(updateCatalogSchema),
  updateCatalog
);
router.delete(
  '/:catalogId',
  deleteCatalog
);

router.post(
  '/:catalogId/entries/:entryId',
  linkCatalogEntry
);
router.delete(
  '/:catalogId/entries/:entryId',
  unlinkCatalogEntry
);

router.get(
  '/:catalogId/share',
  listCollaborators
);

router.post(
  '/:catalogId/share',
  validateBody<InviteCollaboratorRequest>(inviteCollaboratorSchema),
  inviteCollaborator
);

router.patch(
  '/:catalogId/share/:shareId',
  validateBody<UpdateCollaboratorRequest>(updateCollaboratorSchema),
  updateCollaborator
);

export default router;
