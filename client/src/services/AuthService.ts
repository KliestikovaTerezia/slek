import type { AxiosError, AxiosRequestConfig } from 'axios';
import type { ApiToken, LoginCredentials, RegisterData, User } from 'src/contracts';
import { api } from 'src/boot/axios';

class AuthService {
  async me(dontTriggerLogout = false): Promise<User | null> {
    //over ci je token platny a vrat aktualneho usera
    return api
      .get('auth/me', { dontTriggerLogout } as AxiosRequestConfig)
      .then((response) => response.data)
      .catch((error: AxiosError) => {
        //ak token neni platny, vrati null
        if (error.response?.status === 401) {
          return null;
        }

        return Promise.reject(error);
      });
  }

  async register(data: RegisterData): Promise<User> {
    //POST auth/register na registraciu noveho usera
    const response = await api.post<User>('auth/register', data);
    return response.data;
  }

  async login(credentials: LoginCredentials): Promise<ApiToken> {
    const response = await api.post<ApiToken>('auth/login', credentials);
    return response.data;
  }

  async logout(): Promise<void> {
    //informuje backend ze user sa odhlasuje, session konci
    await api.post('auth/logout');
  }
}

export default new AuthService();
