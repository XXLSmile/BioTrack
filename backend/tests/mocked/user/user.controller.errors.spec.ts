import { afterEach, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import { createApp } from '../../../src/core/app';
import { friendshipModel } from '../../../src/models/friends/friend.model';
import { userModel } from '../../../src/models/user/user.model';
import { createUserAndToken } from '../../unmocked/auth/helpers';

const app = createApp();
const api = request(app);

describe('Mocked: UserController error paths', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('updateProfile surfaces unexpected update errors', async () => {
    const token = await createUserAndToken(api);

    jest.spyOn(userModel, 'update').mockRejectedValueOnce(new Error('db error'));

    const response = await api
      .post('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('db error');
  });

  test('updateProfile maps duplicate username errors to 409', async () => {
    const token = await createUserAndToken(api);

    jest.spyOn(userModel, 'isUsernameAvailable').mockResolvedValueOnce(true);
    jest
      .spyOn(userModel, 'update')
      .mockRejectedValueOnce(new Error('E11000 duplicate key error collection: users'));

    const response = await api
      .post('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newusername' });

    expect(response.status).toBe(409);
    expect(response.body?.message).toBe('Username already taken. Please choose a different username.');
  });

  test('deleteProfile propagates failures from friendship cleanup', async () => {
    const token = await createUserAndToken(api);

    jest.spyOn(friendshipModel, 'deleteAllForUser').mockRejectedValueOnce(new Error('friend cleanup failed'));

    const response = await api
      .delete('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('friend cleanup failed');
  });

  test('getUserStats surfaces stats service errors', async () => {
    const token = await createUserAndToken(api);

    jest.spyOn(userModel, 'getUserStats').mockRejectedValueOnce(new Error('stats fetch failed'));

    const response = await api
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('stats fetch failed');
  });

  test('searchUsers propagates search model failures to the global handler', async () => {
    const token = await createUserAndToken(api);

    jest.spyOn(userModel, 'searchByName').mockRejectedValueOnce(new Error('search failed'));

    const response = await api
      .get('/api/user/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ query: 'bird' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });

  test('addFavoriteSpecies propagates model failures to the global handler', async () => {
    const token = await createUserAndToken(api);

    jest.spyOn(userModel, 'addFavoriteSpecies').mockRejectedValueOnce(new Error('favorite add failed'));

    const response = await api
      .post('/api/user/favorite-species')
      .set('Authorization', `Bearer ${token}`)
      .send({ speciesName: 'Sparrow' });

    expect(response.status).toBe(500);
    expect(response.body?.message).toBe('Internal server error');
  });
});
