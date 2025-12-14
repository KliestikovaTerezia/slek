// src/stores/auth.ts
import { defineStore } from 'pinia';
import type { User, LoginCredentials, RegisterData, ApiToken } from 'src/contracts';
import { authService, authManager } from 'src/services';

export interface AuthError {
  message: string;
  field?: string;
}

export interface UserSettings {
  notifyOnlyMentions: boolean; // true = len @mentions, false = vsetky spravy
  notificationSound: boolean; // true = zvuk pri notifikacii
}

const DEFAULT_SETTINGS: UserSettings = {
  notifyOnlyMentions: false,
  notificationSound: false,
};

export interface AuthStateInterface {
  user: User | null;
  status: 'pending' | 'success' | 'error';
  errors: AuthError[];
  settings: UserSettings;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthStateInterface => ({
    user: null,
    status: 'pending',
    errors: [],
    settings: { ...DEFAULT_SETTINGS },
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    loading: (state) => state.status === 'pending',

    token(): string | null {
      return authManager.getToken(); // cita z localStorage
    },
  },

  actions: {
    AUTH_START() {
      this.status = 'pending';
      this.errors = [];
    },

    AUTH_SUCCESS(user: User | null) {
      this.user = user;
      this.status = 'success';
    },

    AUTH_ERROR(errors: AuthError[] | AuthError | string) {
      this.status = 'error';
      this.errors = Array.isArray(errors)
        ? errors
        : [{ message: typeof errors === 'string' ? errors : errors.message }];
    },

    loadSettings() {
      const stored = localStorage.getItem('user-settings');
      if (stored) {
        try {
          this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        } catch (e) {
          console.error('Failed to parse user settings:', e);
          this.settings = { ...DEFAULT_SETTINGS };
        }
      }
    },

    saveSettings(settings: Partial<UserSettings>) {
      this.settings = { ...this.settings, ...settings };
      localStorage.setItem('user-settings', JSON.stringify(this.settings));
    },

    // check ci je user prihlaseny
    async check() {
      const token = authManager.getToken();
      if (!token) {
        this.AUTH_SUCCESS(null);
        return false;
      }
      try {
        this.AUTH_START();
        const user = await authService.me();
        console.log('Auth store: User from /auth/me:', user); // ← Add this
        this.AUTH_SUCCESS(user);
        this.loadSettings();

        return user !== null;
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        this.AUTH_SUCCESS(null);
        return false;
      }
    },

    //registruj noveho usera
    async register(data: RegisterData) {
      try {
        this.AUTH_START();
        const user = await authService.register(data);
        this.AUTH_SUCCESS(null);
        return user;
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        throw error;
      }
    },

    // prihlas usera
    async login(credentials: LoginCredentials) {
      try {
        this.AUTH_START();
        const apiToken: ApiToken = await authService.login(credentials);
        authManager.setToken(apiToken.token);

        // fetch user data after login
        const user = await authService.me();
        this.AUTH_SUCCESS(user);
        this.loadSettings();
        return user;
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        throw error;
      }
    },

    // odhlas usera
    async logout() {
      try {
        this.AUTH_START();
        await authService.logout();
        authManager.removeToken();
        this.AUTH_SUCCESS(null);
        this.settings = { ...DEFAULT_SETTINGS };
        localStorage.removeItem('user-settings');
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        throw error;
      }
    },
  },
});
