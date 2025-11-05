import request from 'supertest';
import mongoose from 'mongoose';

jest.mock('../../src/firebase', () => ({
  __esModule: true,
  messaging: {
    send: jest.fn().mockResolvedValue(undefined),
  },
  default: {
    messaging: {
      send: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock('../../src/socket/socket.manager', () => ({
  emitCatalogDeleted: jest.fn(),
  emitCatalogEntriesUpdated: jest.fn(),
  emitCatalogMetadataUpdated: jest.fn(),
  initializeSocketServer: jest.fn(),
}));

import { createApp } from '../../src/app';
import { catalogModel } from '../../src/catalog/catalog.model';
import { catalogShareModel } from '../../src/catalog/catalogShare.model';
import { catalogEntryLinkModel } from '../../src/catalog/catalogEntryLink.model';
import { catalogRepository } from '../../src/recognition/catalog.model';
import { createTestUser, authHeaderForUser } from '../utils/testHelpers';

const app = createApp();

const createCatalog = async (ownerId: mongoose.Types.ObjectId, name = 'My Catalog') =>
  catalogModel.createCatalog(ownerId, { name });

// Interface GET /catalogs
describe('Unmocked: GET /catalogs', () => {
  // Input: authenticated user with an existing catalog
  // Expected status code: 200
  // Expected behavior: returns catalog list
  // Expected output: array containing created catalog
  test('lists catalogs for the owner', async () => {
    const owner = await createTestUser();
    await createCatalog(owner._id, 'Birds');

    const response = await request(app)
      .get('/api/catalogs')
      .set(authHeaderForUser(owner));

    expect(response.status).toBe(200);
    expect(response.body?.data?.catalogs?.[0]?.name).toBe('Birds');
  });
});

describe('Mocked: GET /catalogs', () => {
  // Input: authenticated user
  // Expected status code: 500
  // Expected behavior: forwards repository error
  // Expected output: internal server error
  // Mock behavior: catalogModel.listCatalogs throws
  test('returns 500 when list fails', async () => {
    const owner = await createTestUser();
    const spy = jest
      .spyOn(catalogModel, 'listCatalogs')
      .mockRejectedValueOnce(new Error('db down'));

    try {
      const response = await request(app)
        .get('/api/catalogs')
        .set(authHeaderForUser(owner));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface POST /catalogs
describe('Unmocked: POST /catalogs', () => {
  // Input: valid catalog payload
  // Expected status code: 201
  // Expected behavior: creates catalog
  // Expected output: catalog data in response
  test('creates catalog for authenticated user', async () => {
    const owner = await createTestUser();

    const response = await request(app)
      .post('/api/catalogs')
      .set(authHeaderForUser(owner))
      .send({ name: 'Wildlife' });

    expect(response.status).toBe(201);
    expect(response.body?.data?.catalog?.name).toBe('Wildlife');
  });

  // Input: duplicate name
  // Expected status code: 409
  // Expected behavior: rejects duplicate catalog
  // Expected output: conflict message
  test('rejects duplicate catalog name', async () => {
    const owner = await createTestUser();
    await request(app)
      .post('/api/catalogs')
      .set(authHeaderForUser(owner))
      .send({ name: 'Unique Catalog' })
      .expect(201);

    const response = await request(app)
      .post('/api/catalogs')
      .set(authHeaderForUser(owner))
      .send({ name: 'Unique Catalog' });

    expect(response.status).toBe(409);
  });
});

describe('Mocked: POST /catalogs', () => {
  // Input: valid payload
  // Expected status code: 500
  // Expected behavior: surfaces repository error
  // Expected output: internal server error
  // Mock behavior: catalogModel.createCatalog throws
  test('returns 500 when creation fails', async () => {
    const owner = await createTestUser();
    const spy = jest
      .spyOn(catalogModel, 'createCatalog')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .post('/api/catalogs')
        .set(authHeaderForUser(owner))
        .send({ name: 'Any' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /catalogs/:catalogId
describe('Unmocked: GET /catalogs/:catalogId', () => {
  // Input: valid catalog id owned by user
  // Expected status code: 200
  // Expected behavior: returns catalog details
  // Expected output: catalog data
  test('returns catalog details for owner', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id, 'Mammals');

    const response = await request(app)
      .get(`/api/catalogs/${catalog._id.toString()}`)
      .set(authHeaderForUser(owner));

    expect(response.status).toBe(200);
    expect(response.body?.data?.catalog?._id).toBe(catalog._id.toString());
  });

  // Input: non-existent catalog id
  // Expected status code: 404
  // Expected behavior: not found response
  // Expected output: message 'Catalog not found'
  test('returns 404 for unknown catalog', async () => {
    const owner = await createTestUser();

    const response = await request(app)
      .get(`/api/catalogs/${new mongoose.Types.ObjectId().toString()}`)
      .set(authHeaderForUser(owner));

    expect(response.status).toBe(404);
  });
});

describe('Mocked: GET /catalogs/:catalogId', () => {
  // Input: valid catalog id
  // Expected status code: 500
  // Expected behavior: forwards repository error
  // Expected output: internal server error
  // Mock behavior: catalogModel.findById throws
  test('returns 500 when lookup fails', async () => {
    const owner = await createTestUser();
    const spy = jest
      .spyOn(catalogModel, 'findById')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get(`/api/catalogs/${new mongoose.Types.ObjectId().toString()}`)
        .set(authHeaderForUser(owner));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface PATCH /catalogs/:catalogId
describe('Unmocked: PATCH /catalogs/:catalogId', () => {
  // Input: valid update payload
  // Expected status code: 200
  // Expected behavior: updates catalog metadata
  // Expected output: updated catalog name
  test('updates catalog name', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id, 'Initial');

    const response = await request(app)
      .patch(`/api/catalogs/${catalog._id.toString()}`)
      .set(authHeaderForUser(owner))
      .send({ name: 'Renamed Catalog' });

    expect(response.status).toBe(200);
    expect(response.body?.data?.catalog?.name).toBe('Renamed Catalog');
  });
});

describe('Mocked: PATCH /catalogs/:catalogId', () => {
  // Input: valid payload
  // Expected status code: 500
  // Expected behavior: handles repository failures
  // Expected output: internal server error
  // Mock behavior: catalogModel.updateCatalog throws
  test('returns 500 when update fails', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const spy = jest
      .spyOn(catalogModel, 'updateCatalog')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .patch(`/api/catalogs/${catalog._id.toString()}`)
        .set(authHeaderForUser(owner))
        .send({ name: 'Renamed' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface DELETE /catalogs/:catalogId
describe('Unmocked: DELETE /catalogs/:catalogId', () => {
  // Input: catalog owned by user
  // Expected status code: 200
  // Expected behavior: deletes catalog
  // Expected output: success message
  test('deletes catalog successfully', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);

    const response = await request(app)
      .delete(`/api/catalogs/${catalog._id.toString()}`)
      .set(authHeaderForUser(owner));

    expect(response.status).toBe(200);
  });
});

describe('Mocked: DELETE /catalogs/:catalogId', () => {
  // Input: catalog id
  // Expected status code: 500
  // Expected behavior: surfaces repository error
  // Expected output: internal server error
  // Mock behavior: catalogModel.deleteCatalog throws
  test('returns 500 when delete fails', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const spy = jest
      .spyOn(catalogModel, 'deleteCatalog')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .delete(`/api/catalogs/${catalog._id.toString()}`)
        .set(authHeaderForUser(owner));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface POST /catalogs/:catalogId/entries/:entryId
describe('Unmocked: POST /catalogs/:catalogId/entries/:entryId', () => {
  // Input: non-existent entry id
  // Expected status code: 404
  // Expected behavior: entry not found error returned
  // Expected output: message 'Observation entry not found'
  test('returns 404 when entry does not exist', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);

    const response = await request(app)
      .post(
        `/api/catalogs/${catalog._id.toString()}/entries/${new mongoose.Types.ObjectId()}`
      )
      .set(authHeaderForUser(owner));

    expect(response.status).toBe(404);
  });
});

describe('Mocked: POST /catalogs/:catalogId/entries/:entryId', () => {
  // Input: valid entry id
  // Expected status code: 200
  // Expected behavior: links entry and returns updated entries
  // Expected output: response with entries array
  // Mock behavior: repository/model methods stubbed to simulate success
  test('links entry successfully when dependencies succeed', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const entryId = new mongoose.Types.ObjectId().toString();

    const findByIdSpy = jest
      .spyOn(catalogRepository, 'findById')
      .mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(entryId),
        userId: owner._id,
      } as any);
    const isLinkedSpy = jest
      .spyOn(catalogEntryLinkModel, 'isEntryLinked')
      .mockResolvedValueOnce(false);
    const linkSpy = jest
      .spyOn(catalogEntryLinkModel, 'linkEntry')
      .mockResolvedValueOnce({
        _id: new mongoose.Types.ObjectId(),
        catalog: catalog._id,
        entry: new mongoose.Types.ObjectId(entryId),
        addedBy: owner._id,
        addedAt: new Date(),
      } as any);
    const listSpy = jest
      .spyOn(catalogEntryLinkModel, 'listEntriesWithDetails')
      .mockResolvedValueOnce([]);

    try {
      const response = await request(app)
        .post(`/api/catalogs/${catalog._id.toString()}/entries/${entryId}`)
        .set(authHeaderForUser(owner));

      expect(response.status).toBe(200);
    } finally {
      findByIdSpy.mockRestore();
      isLinkedSpy.mockRestore();
      linkSpy.mockRestore();
      listSpy.mockRestore();
    }
  });
});

// Interface DELETE /catalogs/:catalogId/entries/:entryId
describe('Unmocked: DELETE /catalogs/:catalogId/entries/:entryId', () => {
  // Input: valid catalog but no entry link
  // Expected status code: 200
  // Expected behavior: returns success even if nothing to remove
  // Expected output: message 'Entry unlinked...'
  test('responds 200 even if entry association absent', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);

    const response = await request(app)
      .delete(
        `/api/catalogs/${catalog._id.toString()}/entries/${new mongoose.Types.ObjectId()}`
      )
      .set(authHeaderForUser(owner));

    expect(response.status).toBe(200);
  });
});

describe('Mocked: DELETE /catalogs/:catalogId/entries/:entryId', () => {
  // Input: parameters referencing catalog/entry
  // Expected status code: 500
  // Expected behavior: surfaces errors from repository
  // Expected output: internal server error
  // Mock behavior: catalogEntryLinkModel.unlinkEntry throws
  test('returns 500 when unlink fails', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const spy = jest
      .spyOn(catalogEntryLinkModel, 'unlinkEntry')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .delete(
          `/api/catalogs/${catalog._id.toString()}/entries/${new mongoose.Types.ObjectId()}`
        )
        .set(authHeaderForUser(owner));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /catalogs/shared-with/me
describe('Unmocked: GET /catalogs/shared-with/me', () => {
  // Input: user with no shares
  // Expected status code: 200
  // Expected behavior: returns empty list
  // Expected output: shares array
  test('returns empty shared-with-me list', async () => {
    const user = await createTestUser();

    const response = await request(app)
      .get('/api/catalogs/shared-with/me')
      .set(authHeaderForUser(user));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body?.data?.shares)).toBe(true);
  });
});

describe('Mocked: GET /catalogs/shared-with/me', () => {
  // Input: authenticated user
  // Expected status code: 500
  // Expected behavior: error forwarded
  // Expected output: internal server error
  // Mock behavior: catalogShareModel.listSharedWithUser throws
  test('returns 500 when listing shared catalogs fails', async () => {
    const user = await createTestUser();
    const spy = jest
      .spyOn(catalogShareModel, 'listSharedWithUser')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/catalogs/shared-with/me')
        .set(authHeaderForUser(user));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /catalogs/share/pending
describe('Unmocked: GET /catalogs/share/pending', () => {
  // Input: user without invitations
  // Expected status code: 200
  // Expected behavior: returns empty list
  // Expected output: shares array
  test('returns empty pending invitations', async () => {
    const user = await createTestUser();

    const response = await request(app)
      .get('/api/catalogs/share/pending')
      .set(authHeaderForUser(user));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body?.data?.shares)).toBe(true);
  });
});

describe('Mocked: GET /catalogs/share/pending', () => {
  // Input: authenticated user
  // Expected status code: 500
  // Expected behavior: error forwarded
  // Expected output: 500
  // Mock behavior: catalogShareModel.listPendingInvitations throws
  test('returns 500 when pending invitation lookup fails', async () => {
    const user = await createTestUser();
    const spy = jest
      .spyOn(catalogShareModel, 'listPendingInvitations')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get('/api/catalogs/share/pending')
        .set(authHeaderForUser(user));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface GET /catalogs/:catalogId/share
describe('Unmocked: GET /catalogs/:catalogId/share', () => {
  // Input: catalog owner with no collaborators
  // Expected status code: 200
  // Expected behavior: returns empty collaborators
  // Expected output: data.collaborators = []
  test('lists collaborators for owned catalog', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);

    const response = await request(app)
      .get(`/api/catalogs/${catalog._id.toString()}/share`)
      .set(authHeaderForUser(owner));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body?.data?.collaborators)).toBe(true);
  });
});

describe('Mocked: GET /catalogs/:catalogId/share', () => {
  // Input: owner request
  // Expected status code: 500
  // Expected behavior: forwards error
  // Expected output: 500
  // Mock behavior: catalogShareModel.listCollaborators throws
  test('returns 500 when collaborator list fails', async () => {
    const owner = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const spy = jest
      .spyOn(catalogShareModel, 'listCollaborators')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .get(`/api/catalogs/${catalog._id.toString()}/share`)
        .set(authHeaderForUser(owner));

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface POST /catalogs/:catalogId/share
describe('Unmocked: POST /catalogs/:catalogId/share', () => {
  // Input: owner invites another user
  // Expected status code: 201
  // Expected behavior: invitation created
  // Expected output: data.invitation present
  test('creates invitation for collaborator', async () => {
    const owner = await createTestUser();
    const invitee = await createTestUser();
    const catalog = await createCatalog(owner._id);

    const response = await request(app)
      .post(`/api/catalogs/${catalog._id.toString()}/share`)
      .set(authHeaderForUser(owner))
      .send({ inviteeId: invitee._id.toString(), role: 'viewer' });

    expect(response.status).toBe(201);
    expect(response.body?.data?.invitation?.invitee).toBe(
      invitee._id.toString()
    );
  });
});

describe('Mocked: POST /catalogs/:catalogId/share', () => {
  // Input: valid payload
  // Expected status code: 500
  // Expected behavior: error forwarded
  // Expected output: 500
  // Mock behavior: catalogShareModel.createInvitation throws
  test('returns 500 when invitation creation fails', async () => {
    const owner = await createTestUser();
    const invitee = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const spy = jest
      .spyOn(catalogShareModel, 'createInvitation')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .post(`/api/catalogs/${catalog._id.toString()}/share`)
        .set(authHeaderForUser(owner))
        .send({ inviteeId: invitee._id.toString(), role: 'viewer' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface PATCH /catalogs/:catalogId/share/:shareId
describe('Unmocked: PATCH /catalogs/:catalogId/share/:shareId', () => {
  // Input: owner revokes invitation
  // Expected status code: 200
  // Expected behavior: invitation status updated
  // Expected output: invitation status revoked
  test('revokes collaborator invitation', async () => {
    const owner = await createTestUser();
    const invitee = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const invitation = await catalogShareModel.createInvitation(
      catalog._id,
      catalog.owner,
      invitee._id,
      owner._id,
      'viewer'
    );

    const response = await request(app)
      .patch(`/api/catalogs/${catalog._id.toString()}/share/${invitation._id.toString()}`)
      .set(authHeaderForUser(owner))
      .send({ action: 'revoke' });

    expect(response.status).toBe(200);
    expect(response.body?.data?.invitation?.status).toBe('revoked');
  });
});

describe('Mocked: PATCH /catalogs/:catalogId/share/:shareId', () => {
  // Input: owner updates collaborator
  // Expected status code: 500
  // Expected behavior: error forwarded
  // Expected output: internal server error
  // Mock behavior: catalogShareModel.revokeInvitation throws
  test('returns 500 when collaborator update fails', async () => {
    const owner = await createTestUser();
    const invitee = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const invitation = await catalogShareModel.createInvitation(
      catalog._id,
      catalog.owner,
      invitee._id,
      owner._id,
      'viewer'
    );
    const spy = jest
      .spyOn(catalogShareModel, 'revokeInvitation')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .patch(`/api/catalogs/${catalog._id.toString()}/share/${invitation._id.toString()}`)
        .set(authHeaderForUser(owner))
        .send({ action: 'revoke' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});

// Interface PATCH /catalogs/share/:shareId/respond
describe('Unmocked: PATCH /catalogs/share/:shareId/respond', () => {
  // Input: invitee accepts invitation
  // Expected status code: 200
  // Expected behavior: status updated to accepted
  // Expected output: invitation status accepted
  test('invitee accepts invitation', async () => {
    const owner = await createTestUser();
    const invitee = await createTestUser();
    const catalog = await createCatalog(owner._id);
    const invitation = await catalogShareModel.createInvitation(
      catalog._id,
      catalog.owner,
      invitee._id,
      owner._id,
      'viewer'
    );

    const response = await request(app)
      .patch(`/api/catalogs/share/${invitation._id.toString()}/respond`)
      .set(authHeaderForUser(invitee))
      .send({ action: 'accept' });

    expect(response.status).toBe(200);
    expect(response.body?.data?.invitation?.status).toBe('accepted');
  });
});

describe('Mocked: PATCH /catalogs/share/:shareId/respond', () => {
  // Input: invitee responds
  // Expected status code: 500
  // Expected behavior: surfaces repository error
  // Expected output: 500
  // Mock behavior: catalogShareModel.findById throws
  test('returns 500 when invitation lookup fails', async () => {
    const invitee = await createTestUser();
    const spy = jest
      .spyOn(catalogShareModel, 'findById')
      .mockRejectedValueOnce(new Error('db failure'));

    try {
      const response = await request(app)
        .patch(`/api/catalogs/share/${new mongoose.Types.ObjectId().toString()}/respond`)
        .set(authHeaderForUser(invitee))
        .send({ action: 'accept' });

      expect(response.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
