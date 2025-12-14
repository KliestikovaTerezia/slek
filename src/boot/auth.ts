import { boot } from 'quasar/wrappers';
import { authManager } from 'src/services';
import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router';
import { useAuthStore } from 'src/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
  }
}

const loginRoute = (from: RouteLocationNormalized): RouteLocationRaw => {
  return {
    name: 'login',
    query: { redirect: from.fullPath },
  };
};

export default boot(({ router }: { router: Router }) => {
  const authStore = useAuthStore();

  authManager.onLogout(() => {
    void router.push(loginRoute(router.currentRoute.value));
  });

  router.beforeEach(async (to, _from, next) => {
    const isAuthenticated = await authStore.check();

    if (to.meta.requiresAuth && !isAuthenticated) {
      return next(loginRoute(to));
    }

    if (to.meta.guestOnly && isAuthenticated) {
      return next({ name: 'home' });
    }

    return next();
  });
});
