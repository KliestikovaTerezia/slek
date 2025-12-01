// src/types/UserStatus.ts
export type UserStatusType = 'online' | 'dnd' | 'offline';

export interface UserStatus {
  type: UserStatusType;
  color: string;
}

// Mapa pre rýchly lookup
export const statusMap: Record<UserStatusType, UserStatus> = {
  online: { type: 'online', color: '#4caf50' },
  dnd: { type: 'dnd', color: '#9e9e9e' },
  offline: { type: 'offline', color: '#f44336' },
};
