export interface Invitation {
  id: number;
  channelId: number;
  channelName: string;
  channelType: 'public' | 'private';
  from: string;
  fromAvatar: string | null;
  createdAt: string;
}

export type InvitationWithUserId = Invitation & { userId: number };
