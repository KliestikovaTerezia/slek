import { defineStore } from 'pinia';
import type { SerializedMessage } from 'src/contracts';
import channelService from 'src/services/ChannelService';
import type { DisplayMessage } from 'src/types/message';
import { useAuthStore } from 'src/stores/auth';
import { api } from 'src/boot/axios';

interface Member {
  id: number;
  name: string;
  avatar: string;
  isAdmin: boolean;
}

interface ChannelData {
  id: number;
  name: string;
  type: 'public' | 'private';
  members: Member[];
  isAdmin: boolean;
}

export const useChannelsStore = defineStore('channels', {
  state: () => ({
    loading: false,
    error: null as Error | null,
    messages: {} as Record<string, DisplayMessage[]>,
    active: null as string | null,
    channelsList: [] as ChannelData[],

    // ulozime id poslednej sprsvy ktoru user spracoval
    lastProcessedMessageId: {} as Record<string, number>,
  }),

  getters: {
    joinedChannels(state) {
      return Object.keys(state.messages);
    },
    currentMessages(state) {
      return state.active !== null ? state.messages[state.active] : [];
    },
    lastMessageOf: (state) => (channel: string) => {
      const msgs = state.messages[channel];
      return msgs?.length ? msgs[msgs.length - 1] : null;
    },
    activeChannel(state) {
      if (!state.active) return null;
      return state.channelsList.find((ch) => ch.name === state.active) || null;
    },
    activeChannelMembers(state) {
      const channel = state.channelsList.find((ch) => ch.name === state.active);
      return channel?.members || [];
    },
    lastProcessedIdOf: (state) => (channel: string) => {
      // vrati ID alebo 0, ak nebola spracovana ziadna sprava
      return state.lastProcessedMessageId[channel] || 0;
    },
  },

  actions: {
    // propoj do kanala a nacitaj historiu
    async join(channel: string) {
      try {
        this.loading = true;
        this.error = null;

        const socket = channelService.join(channel);
        const messages = await socket.loadMessages();

        this.messages[channel] = messages.map((m) => ({
          id: m.id,
          user: m.author.nickname || m.author.email.split('@')[0],
          text: m.content,
        }));
        this.active = channel;
      } catch (err) {
        this.error = err as Error;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    removeChannelById(channelId: number) {
      // filter aby sme vytvorili nove pole bez kanala so zadanym ID
      this.channelsList = this.channelsList.filter((channel) => channel.id !== channelId);
    },

    async fetchChannels() {
      try {
        this.loading = true;
        const response = await api.get('/api/channels');
        this.channelsList = response.data;
      } catch (err) {
        this.error = err as Error;
        console.error('Failed to fetch channels:', err);
      } finally {
        this.loading = false;
      }
    },

    async fetchAllChannels() {
      try {
        const response = await api.get('/api/channels/all');
        return response.data;
      } catch (err) {
        console.error('Failed to fetch all channels:', err);
        return [];
      }
    },

    //nacita spravy ktore prichadzali pocas offline, nevideli sme ich
    async loadMissedMessagesForAll() {
      for (const channelName of this.joinedChannels) {
        try {
          const socket = channelService.join(channelName);
          if (!socket) continue;

          // ziskanie posledneho znameho ID
          const sinceId = this.lastProcessedIdOf(channelName);

          console.log(`[Catch-up] Načítavam správy pre ${channelName} od ID: ${sinceId}`);

          // ziskanie chybajucich sprav zo servera
          const newMessages = await socket.loadMessages({ sinceId });

          // spracovanie a ulozenie nových sprav
          newMessages.forEach((m) => this.newMessage(channelName, m));
        } catch (error) {
          console.error(`Chyba pri načítaní zmeškaných správ pre ${channelName}:`, error);
        }
      }
    },

    // odpojenie z channel
    leave(channel: string | null) {
      const leaving = channel ? [channel] : this.joinedChannels;

      leaving.forEach((c) => {
        channelService.leave(c);
        delete this.messages[c];
        if (this.active === c) this.active = null;
      });
    },

    // odoslanie spravy
    async addMessage(channel: string, text: string) {
      const socket = channelService.in(channel);
      if (!socket) return;

      const newMessage = await socket.addMessage(text);

      if (!this.messages[channel]) this.messages[channel] = [];

      this.messages[channel].push({
        id: newMessage.id,
        user: newMessage.author.nickname || newMessage.author.email.split('@')[0],
        text: newMessage.content,
      });
    },

    // prijatie spravy zo socketu (real-time)
    newMessage(channel: string, message: SerializedMessage) {
      if (!this.messages[channel]) {
        this.messages[channel] = [];
      }

      // zabran duplikatom podla id
      const exists = this.messages[channel].some((m) => m.id === message.id);
      if (exists) {
        console.log('DUPLICATE IGNORED:', message.id, message.content);
        return;
      }
      // mention detekcia
      const authStore = useAuthStore();
      const myNickname = authStore.user?.nickname || authStore.user?.email.split('@')[0];

      const mentionRegex = new RegExp(`@(${myNickname})\\b`, 'i');
      const isMentioned = mentionRegex.test(message.content);

      const user = message.author.nickname;

      if (message.id > (this.lastProcessedMessageId[channel] || 0)) {
        this.lastProcessedMessageId[channel] = message.id;
      }

      this.messages[channel].push({
        id: message.id,
        user,
        text: message.content,
        isMentioned,
      } as DisplayMessage);
    },

    setActive(channel: string) {
      this.active = channel;
    },

    async rejoinActiveChannel() {
      const active = this.activeChannel;
      if (!active) return;

      const socket = channelService.join(active.name);
      if (!socket.socket.connected) {
        await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
      }

      try {
        await socket.joinChannel();

        if (!this.messages[active.name] || this.messages[active.name].length === 0) {
          const messages = await socket.loadMessages();
          messages.forEach((m) => this.newMessage(active.name, m));
        }
      } catch (err) {
        console.error('Auto-rejoin failed:', err);
      }
    },
  },
});
