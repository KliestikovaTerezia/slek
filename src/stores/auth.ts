// src/stores/auth.ts
import { defineStore } from 'pinia';
import type { User, LoginCredentials, RegisterData, ApiToken } from 'src/contracts';
import { authService, authManager } from 'src/services';

export interface AuthError {
  message: string;
  field?: string;
}

export interface AuthStateInterface {
  user: User | null;
  status: 'pending' | 'success' | 'error';
  errors: AuthError[];
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthStateInterface => ({
    user: null,
    status: 'pending',
    errors: [],
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    loading: (state) => state.status === 'pending',

    token(): string | null {
      return authManager.getToken(); // this reads from localStorage
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

    /**
     * Check if user is logged in by fetching /auth/me
     */
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
        return user !== null;
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        this.AUTH_SUCCESS(null);
        return false;
      }
    },

    /**
     * Register new user
     */
    async register(data: RegisterData) {
      try {
        this.AUTH_START();
        const user = await authService.register(data);
        // Po registrácii typicky presmeruješ na login, user ostáva null
        this.AUTH_SUCCESS(null);
        return user;
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        throw error;
      }
    },

    /**
     * Login user
     */
    async login(credentials: LoginCredentials) {
      try {
        this.AUTH_START();
        const apiToken: ApiToken = await authService.login(credentials);
        authManager.setToken(apiToken.token);

        // fetch user data after login
        const user = await authService.me();
        // this.AUTH_SUCCESS(user);
        this.AUTH_SUCCESS(user);
        return user;
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        throw error;
      }
    },

    /**
     * Logout user
     */
    async logout() {
      try {
        this.AUTH_START();
        await authService.logout();
        authManager.removeToken();
        this.AUTH_SUCCESS(null);
      } catch (error: unknown) {
        this.AUTH_ERROR((error as Error).message);
        throw error;
      }
    },
  },
});
