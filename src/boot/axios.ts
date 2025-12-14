import { boot } from 'quasar/wrappers';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { authManager } from 'src/services';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
    $api: AxiosInstance;
  }
}
const api = axios.create({
  baseURL: 'http://127.0.0.1:3333',
  withCredentials: true,
  headers: {},
});

const DEBUG = process.env.NODE_ENV === 'development';

api.interceptors.request.use(
  (config) => {
    const token = authManager.getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (DEBUG) {
      console.info('-> ', config);
    }

    return config;
  },
  (error) => {
    if (DEBUG) {
      console.error('-> ', error);
    }

    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);

api.interceptors.response.use(
  (response) => {
    if (DEBUG) {
      console.info('<- ', response);
    }

    return response;
  },
  (error) => {
    if (DEBUG) {
      console.error('<- ', error.response);
    }

    if (error.response.status === 401 && !error.response.config.dontTriggerLogout) {
      authManager.logout();
    }

    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  },
);

import type { App } from 'vue';

export default boot(({ app }: { app: App }) => {
  app.config.globalProperties.$axios = axios;
  app.config.globalProperties.$api = api;
});

export { api };
