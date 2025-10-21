import mongoose, { Document } from 'mongoose';
import { z } from 'zod';

export type CatalogShareRole = 'viewer' | 'editor';
export type CatalogShareStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface ICatalogShare extends Document {
  _id: mongoose.Types.ObjectId;
  catalog: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  invitee: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  role: CatalogShareRole;
  status: CatalogShareStatus;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const inviteCollaboratorSchema = z.object({
  inviteeId: z.string().min(1, 'Invitee ID is required'),
  role: z.enum(['viewer', 'editor']).default('viewer'),
});

export type InviteCollaboratorRequest = z.infer<typeof inviteCollaboratorSchema>;

export const respondToInvitationSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export type RespondToInvitationRequest = z.infer<typeof respondToInvitationSchema>;

export const updateCollaboratorSchema = z
  .object({
    role: z.enum(['viewer', 'editor']).optional(),
    action: z.enum(['revoke']).optional(),
  })
  .refine(
    data => (data.role ? true : data.action === 'revoke'),
    {
      message: 'Provide a new role or revoke the invitation',
    }
  );

export type UpdateCollaboratorRequest = z.infer<typeof updateCollaboratorSchema>;

