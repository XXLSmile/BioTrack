import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { userModel } from '../../../src/models/user/user.model';
import { createUserAndToken, VALID_GOOGLE_PAYLOAD } from '../auth/helpers';

const app = createApp();
const api = request(app);

describe('API: /api/user/favorite-species', () => {
  beforeEach(async () => {
    await userModel.deleteAllUsers();
  });

  afterEach(async () => {
    await userModel.deleteAllUsers();
    jest.restoreAllMocks();
  });

  test('adds a favorite species for the authenticated user', async () => {
    const token = await createUserAndToken(api);

    const response = await api
      .post('/api/user/favorite-species')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesName: 'American Robin' });

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Favorite species added successfully');

    const stored = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
    expect(stored?.favoriteSpecies).toContain('American Robin');
  });

  test('requires a speciesName payload when adding', async () => {
    const token = await createUserAndToken(api);

    const response = await api
      .post('/api/user/favorite-species')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesName: '   ' });

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Species name is required');
  });

  test('removes a favorite species when provided', async () => {
    const token = await createUserAndToken(api);
    const user = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
    if (!user) {
      throw new Error('user not created');
    }
    await userModel.addFavoriteSpecies(user._id, 'American Robin');

    const response = await api
      .delete('/api/user/favorite-species')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesName: 'American Robin' });

    expect(response.status).toBe(200);
    expect(response.body?.message).toBe('Favorite species removed successfully');

    const stored = await userModel.findByGoogleId(VALID_GOOGLE_PAYLOAD.sub);
    expect(stored?.favoriteSpecies).not.toContain('American Robin');
  });

  test('requires speciesName when removing', async () => {
    const token = await createUserAndToken(api);

    const response = await api
      .delete('/api/user/favorite-species')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body?.message).toBe('Species name is required');
  });

  test('protects favorite-species endpoints when unauthenticated', async () => {
    const addResponse = await api.post('/api/user/favorite-species').send({ speciesName: 'Test' });
    expect(addResponse.status).toBe(401);
    expect(addResponse.body?.message).toBe('Authentication required');

    const deleteResponse = await api.delete('/api/user/favorite-species').send({ speciesName: 'Test' });
    expect(deleteResponse.status).toBe(401);
    expect(deleteResponse.body?.message).toBe('Authentication required');
  });

  test('bubbles up server errors when adding favorites fails', async () => {
    const token = await createUserAndToken(api);
    jest.spyOn(userModel, 'addFavoriteSpecies').mockRejectedValueOnce(new Error('boom'));

    const response = await api
      .post('/api/user/favorite-species')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesName: 'Golden Eagle' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('handles errors when removing favorite species fails', async () => {
    const token = await createUserAndToken(api);
    jest.spyOn(userModel, 'removeFavoriteSpecies').mockRejectedValueOnce(new Error('remove failed'));

    const response = await api
      .delete('/api/user/favorite-species')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesName: 'Test Species' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});
