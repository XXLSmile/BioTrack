import mongoose from 'mongoose';
import type { SuperTest, Test } from 'supertest';
import {
  createUserAndTokenWithPayload,
  getCachedUserByGoogleId,
} from '../auth/helpers';

export const dropTestDb = async () => {
  const db = mongoose.connection.db;
  if (db) {
    await db.dropDatabase();
  }
};

const makePayload = (label: string) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return {
    sub: `friend-${label}-${timestamp}-${randomSuffix}`,
    email: `${label}-${randomSuffix}@example.com`,
    name: `Friend ${label}`,
  };
};

export const registerUser = async (api: SuperTest<Test>, label: string) => {
  const payload = makePayload(label);
  const token = await createUserAndTokenWithPayload(api, payload);
  const user = getCachedUserByGoogleId(payload.sub as string);
  if (!user) {
    throw new Error('Failed to create test user');
  }
  return { token, user };
};

export const sendFriendRequest = (
  api: SuperTest<Test>,
  token: string,
  targetUserId: string
) =>
  api.post('/api/friends/requests').set('Authorization', `Bearer ${token}`).send({
    targetUserId,
  });

export const respondFriendRequest = (
  api: SuperTest<Test>,
  token: string,
  requestId: string,
  action: 'accept' | 'decline'
) =>
  api.patch(`/api/friends/requests/${requestId}`).set('Authorization', `Bearer ${token}`).send({
    action,
  });

export const cancelFriendRequest = (
  api: SuperTest<Test>,
  token: string,
  requestId: string
) =>
  api.delete(`/api/friends/requests/${requestId}`).set('Authorization', `Bearer ${token}`);

export const deleteFriendship = (
  api: SuperTest<Test>,
  token: string,
  friendshipId: string
) =>
  api.delete(`/api/friends/${friendshipId}`).set('Authorization', `Bearer ${token}`);
