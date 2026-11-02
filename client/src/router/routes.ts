import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: () => ({ name: 'home' }),
  },
  {
    path: '/auth',
    component: () => import('src/layouts/MainLayout.vue'),
    children: [
      {
        path: 'register',
        name: 'register',
        meta: { guestOnly: true },
        component: () => import('src/pages/RegisterPage.vue'),
      },
      {
        path: 'login',
        name: 'login',
        meta: { guestOnly: true },
        component: () => import('src/pages/LoginPage.vue'),
      },
    ],
  },
  {
    path: '/channels',
    // channels musi mat auth
    meta: { requiresAuth: true },
    component: () => import('src/layouts/MainLayout.vue'),
    children: [{ path: '', name: 'home', component: () => import('src/pages/ChatPage.vue') }],
  },
];

export default routes;
