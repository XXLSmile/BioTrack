import { describe, expect, test } from '@jest/globals';

import {
  inviteCollaboratorSchema,
  respondToInvitationSchema,
  updateCollaboratorSchema,
} from '../../../src/types/catalogShare.types';

describe('Mocked: catalogShare.types', () => {
  // API: inviteCollaboratorSchema
  // Input: payload missing inviteeId
  // Expected behavior: schema rejects with validation error
  // Expected output: ZodError with Invitee ID message
  test('inviteCollaboratorSchema requires non-empty inviteeId', () => {
    expect(() => inviteCollaboratorSchema.parse({ inviteeId: '', role: 'viewer' })).toThrow(/Invitee ID is required/);

    const result = inviteCollaboratorSchema.parse({ inviteeId: 'abc123' });
    expect(result.role).toBe('viewer');
  });

  // API: respondToInvitationSchema
  // Input: action outside enum
  // Expected behavior: throws validation error
  // Expected output: ZodError
  test('respondToInvitationSchema validates action enum', () => {
    expect(() => respondToInvitationSchema.parse({ action: 'noop' as any })).toThrow(/Invalid option/);

    expect(respondToInvitationSchema.parse({ action: 'accept' }).action).toBe('accept');
  });

  // API: updateCollaboratorSchema
  // Input: payload without role or revoke action
  // Expected behavior: refine enforces either role or revoke
  // Expected output: ZodError referencing refine message
  test('updateCollaboratorSchema enforces role or revoke action', () => {
    expect(() => updateCollaboratorSchema.parse({})).toThrow(/Provide a new role or revoke the invitation/);

    expect(updateCollaboratorSchema.parse({ action: 'revoke' }).action).toBe('revoke');
    expect(updateCollaboratorSchema.parse({ role: 'editor' }).role).toBe('editor');
  });
});
