import { boot } from 'quasar/wrappers';
import { authManager } from 'src/services';
import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router';
import { useAuthStore } from 'src/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean; //route needs a logged in user
    guestOnly?: boolean; //route is only for non-logged in users
  }
}

const loginRoute = (from: RouteLocationNormalized): RouteLocationRaw => {
  //creates a login route object
  return {
    name: 'login',
    query: { redirect: from.fullPath },
  };
};

export default boot(({ router }: { router: Router }) => {
  //when app boots up
  const authStore = useAuthStore(); //we store if the user is authenticated

  authManager.onLogout(() => {
    //listens for logout events
    void router.push(loginRoute(router.currentRoute.value)); //redirect to login
  });

  router.beforeEach(async (to, _from, next) => {
    //before each route change
    const isAuthenticated = await authStore.check();

    if (to.meta.requiresAuth && !isAuthenticated) {
      //if the route requires auth and user is not authenticated
      return next(loginRoute(to));
    }

    if (to.meta.guestOnly && isAuthenticated) {
      //if the route is for guests only and user is authenticated
      return next({ name: 'home' });
    }

    return next(); // proceed to the route
  });
});
