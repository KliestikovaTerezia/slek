import { defineStore } from 'pinia';
import GlobalSocketService from 'src/services/GlobalService';
import type { Notification } from 'src/types/notification';
import { api } from 'src/boot/axios';

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [] as Notification[],
    initialized: false,
    loaded: false,
  }),

  actions: {
    init() {
      if (this.initialized) return;
      this.initialized = true;

      // Listener na nove notifikacie
      GlobalSocketService.socket.on('notification:new', (notif: Notification) => {
        console.log('New notification received via WS:', notif);
        this.notifications.unshift(notif);
      });
    },
    async dismiss(index: number) {
      const notif = this.notifications[index];
      if (!notif) return;

      try {
        await api.delete(`/api/notifications/${notif.id}`);
      } catch (err) {
        console.error('Failed to delete notification:', err);
      }

      this.notifications.splice(index, 1);
    },

    async loadNotifications() {
      if (this.loaded) return;

      try {
        const res = await api.get('/api/notifications');
        this.notifications = res.data;
        this.loaded = true;
        console.log('[NOTIFICATIONS] Loaded:', this.notifications);
      } catch (err) {
        console.error('[NOTIFICATIONS] Failed to load', err);
      }
    },
  },
});
