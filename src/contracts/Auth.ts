import { type UserStatusType } from '../types/UserStatus';

export interface ApiToken {
  type: 'bearer';
  token: string;
  expires_at?: string;
  expires_in?: number;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  avatar?: string | undefined; // base64 string
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember: boolean;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
  avatar: string | null;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  status: UserStatusType;
}
