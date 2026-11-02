import { defineStore } from 'pinia';
import type { UserStatusType } from 'src/types/UserStatus';
import { useAuthStore } from './auth';
import { statusMap } from 'src/types/UserStatus';
import { api } from 'src/boot/axios';

export const useStatusStore = defineStore('status', {
  state: () => ({
    myStatus: 'online' as UserStatusType,
    userStatuses: {} as Record<string, UserStatusType>,
    userDnds: {} as Record<string, boolean>,
    initialized: false,
  }),

  getters: {
    statusObj(state) {
      return statusMap[state.myStatus] || statusMap.offline;
    },
    isMyDndActive: (state) => {
      const authStore = useAuthStore();
      const myNickname = authStore.user?.nickname;
      if (!myNickname) return false;
      return state.userDnds[myNickname] ?? false;
    },
  },

  actions: {
    async init() {
      if (this.initialized) return;
      this.initialized = true;

      const authStore = useAuthStore();
      if (authStore.user?.status) {
        this.myStatus = authStore.user.status || 'online';
      }

      const GlobalSocketService = (await import('src/services/GlobalService')).default;
      // Ked zmenis status ty
      GlobalSocketService.socket.on('status:updated', (newStatus: UserStatusType) => {
        console.log('STATUS EVENT RECEIVED (me):', newStatus);
        this.myStatus = newStatus;
      });

      // Ked zmeni status NIEKTO INY
      GlobalSocketService.socket.on('user:statusUpdated', (payload) => {
        if (this.myStatus === 'online') {
          console.log('STATUS EVENT RECEIVED (others):', payload);
          this.userStatuses[payload.nickname] = payload.status;
        }
      });
      GlobalSocketService.socket.on('user:dndUpdated', (payload) => {
        console.log('STATUS EVENT RECEIVED (others):', payload);
        this.userDnds[payload.nickname] = payload.dnd;
      });
    },

    updateStatuses(payload: unknown) {
      const list = Array.isArray(payload) ? payload : [payload];

      list.forEach((u) => {
        if (!u.nickname || !u.status) return;
        this.userStatuses[u.nickname] = u.status;
      });

      console.log('ALL statuses:', this.userStatuses);
    },
    updateDnds(payload: unknown) {
      const list = Array.isArray(payload) ? payload : [payload];

      list.forEach((u) => {
        if (!u.nickname) return;
        this.userDnds[u.nickname] = Boolean(u.dnd);
      });

      console.log('ALL DNDs:', this.userDnds);
    },

    setMyStatus(newStatus: UserStatusType) {
      this.myStatus = newStatus;
    },
    async fetchMyDnd() {
      try {
        const response = await api.get<{ dnd: number }>('/api/users/dnd');
        const authStore = useAuthStore();
        const myNickname = authStore.user?.nickname || 'me';

        this.userDnds[myNickname] = response.data.dnd === 1;

        console.log('Loaded my DND from DB:', response.data.dnd);
      } catch (err) {
        console.error('Failed to fetch my DND state:', err);
      }
    },
    getMyDnd(nickname: string) {
      return this.userDnds[nickname] ?? false;
    },
  },
});
