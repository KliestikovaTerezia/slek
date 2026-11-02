export type UserStatusType = 'online' | 'dnd' | 'offline';

export interface UserStatusPayload {
  userId: number;
  status: UserStatusType;
  updatedAt: string; 
}
