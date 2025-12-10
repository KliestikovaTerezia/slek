import {
  SocketManager,
  type BootParams,
  type SocketManagerConstructorContract,
} from './SocketManager';
import { useChannelsStore } from 'src/stores/channels';
import type { SerializedMessage } from 'src/contracts';
import type { Invitation } from 'src/types/invitation';
import notificationService from './NotificationService';
import { useAuthStore } from 'src/stores/auth';
// import { useStatusStore } from 'src/stores/status';

export interface BanStatus {
  status: 'ok' | 'banned' | 'not_found';
  message?: string;
}

export interface LoadMessagesOptions {
  sinceId?: number;
}

export class ChannelSocketManager extends SocketManager {
  private subscribed = false;
  public isJoined = false;

  // VOLAJ TOTO PRI PRVOM JOIN!
  public join(params?: BootParams): this {
    if (params) {
      this.subscribe(); // zavolá subscribe s Quasar boot params
    } else {
      if (!this.subscribed) {
        console.warn('ChannelSocketManager join called without boot params!');
      }
    }

    this.socket.connect();
    return this;
  }

  //pocuva na kicks
  public onUserKicked(
    callback: (data: {
      userId: number;
      nickname: string;
      displayName: string;
      bannedBy: string;
      isAdmin: boolean;
    }) => void,
  ) {
    this.socket.on('user:kicked', callback);
  }

  public onInvitationReceived(callback: (invitation: Invitation) => void) {
    this.socket.on('invitation:received', callback);
  }

  public onMemberJoined(
    callback: (data: {
      userId: number;
      nickname: string;
      avatar: string;
      channelName: string;
    }) => void,
  ) {
    this.socket.on('member:joined', callback);
  }

  // ==================== INVITATION METHODS ====================

  public async inviteUsers(nicknames: string[]): Promise<{
    success: boolean;
    invitationsSent: number;
    invitations?: Invitation[];
  }> {
    return this.emitAsync('inviteUsers', nicknames);
  }

  public async revokeUser(nickname: string): Promise<{
    success: true;
    message: string;
  }> {
    return this.emitAsync('revokeUser', nickname);
  }

  public async deleteChannel(channelId: number): Promise<{
    message: string;
  }> {
    // ✅ Odošleme ID kanála (názov sa neposiela, lebo ID je unikátny identifikátor)
    return this.emitAsync('deleteChannel', channelId);
  }

  public async checkBanStatus(channelName: string): Promise<BanStatus> {
    // Používame globálne volanie (cez manažér, ku ktorému sme pripojení, napr. 'General')
    return this.emitAsync('checkBanStatus', channelName);
  }

  public async sendStatus(status: 'online' | 'offline'): Promise<{
    success: boolean;
    status: string;
  }> {
    console.log('Sending status via ChannelSocket:', status);
    return this.emitAsync('updateStatus', { status });
  }

  public async fetchAllStatuses(): Promise<void> {
    try {
      const response = await this.emitAsync('getAllStatuses', {});
      if (Array.isArray(response)) {
        const payload = response.map((u) => ({
          nickname: u.nickname,
          status: u.status,
        }));

        // ✅ dynamický import store, aby sa predišlo cyklu
        const { useStatusStore } = await import('src/stores/status');
        const statusStore = useStatusStore();
        statusStore.updateStatuses(payload);

        console.log('Fetched all user statuses:', payload);
      }
    } catch (err) {
      console.error('Failed to fetch all user statuses:', err);
    }
  }

  public async acceptInvitation(invitationId: number): Promise<{
    success: true;
    channel: {
      id: number;
      name: string;
      type: 'public' | 'private';
      isAdmin: boolean;
    };
  }> {
    return this.emitAsync('acceptInvitation', invitationId);
  }

  public async declineInvitation(invitationId: number): Promise<unknown> {
    return this.emitAsync('declineInvitation', invitationId);
  }

  public async getInvitations(): Promise<Invitation[]> {
    return this.emitAsync('getInvitations');
  }

  public destroy(): void {
    (this.constructor as SocketManagerConstructorContract).destroyInstance(this);

    // 🚨 KĽÚČOVÉ RIEŠENIE: Prístup k singletonu cez dynamický import (ktorý rieši cykly)
    // Aj keď je to v tom istom súbore, toto je najspoľahlivejší mechanizmus
    // v modernom JS/TS pri mixovaní inštancií.
    import('./ChannelService')
      .then((module) => {
        // module.default je vaša singleton inštancia new ChannelService()
        module.default.removeInstance(this.namespace);
      })
      .catch((err) => {
        console.error('Failed to remove channel instance during destroy:', err);
      });
  }

  public subscribe(): void {
    if (this.subscribed) {
      console.log('Already subscribed to:', this.namespace);
      return;
    }

    const channelStore = useChannelsStore();
    const channel = this.namespace.split('/').pop() as string;
    const authStore = useAuthStore();

    this.socket.on('connect', () => {
      console.log('Socket CONNECTED:', this.namespace);
    });

    this.socket.on('connect_error', (err) => {
      console.error('CONNECT ERROR:', err.message, err);
    });

    this.socket.onAny((event, ...args) => {
      console.log(`[SOCKET] ${this.namespace} [${event}]`, args);
    });

    // ZABRAŇ DUPLIKÁCII!
    this.socket.off('message');
    this.socket.on('message', (msg: SerializedMessage) => {
      console.log('Received message:', msg);
      channelStore.newMessage(channel, msg);

      const currentUser = authStore.user?.nickname;
      const isMyMessage = msg.author.nickname === currentUser;

      if (isMyMessage || !currentUser) return;

      const notifyOnlyMentions = authStore.settings?.notifyOnlyMentions ?? false;
      const isMentioned = msg.content.toLowerCase().includes(`@${currentUser.toLowerCase()}`);
      const shouldNotify = notifyOnlyMentions ? isMentioned : true;

      if (shouldNotify) {
        const preview = msg.content.length > 80 ? msg.content.substring(0, 80) + '…' : msg.content;

        void notificationService.showIfHidden({
          title: `${msg.author.nickname} v #${channel}`,
          body: preview,
          icon: msg.author.avatar || '/icons/favicon-128x128.png',
          tag: `msg-${msg.id}-${channel}`,
          data: { channel, messageId: msg.id },
        });
      }
    });

    // Add BEFORE  this.subscribed = true;
    this.socket.off('members:update');
    this.socket.on('members:update', ({ channelId, members }) => {
      console.log('LIVE MEMBERS UPDATE:', channelId, members);

      const store = useChannelsStore();
      const ch = store.channelsList.find((c) => c.id === channelId);

      if (ch) {
        ch.members = members; // <- reactive update 🔥
      }

      // Optional: If current /list view is visible, reactive rerender handles it automatically
    });

    this.socket.off('member:left');
    this.socket.on('member:left', (payload) => {
      console.log('MEMBER LEFT:', payload);

      const store = useChannelsStore();
      const ch = store.channelsList.find((c) => c.name === payload.channelName);

      if (ch) {
        ch.members = ch.members.filter((m) => m.id !== payload.userId);
      }
    });

    // this.socket.off('channel:deleted');
    this.socket.on('channel:deleted', ({ channelId, channelName }) => {
      console.log('CHANNEL DELETED:', channelName);

      const store = useChannelsStore();
      const index = store.channelsList.findIndex((c) => c.id === channelId);

      if (index !== -1) {
        store.channelsList.splice(index, 1);

        // Ak bol aktívny tento kanál, prepni na prvý dostupný
        if (store.activeChannel?.id === channelId) {
          store.setActive(store.channelsList[0]?.name || '');
        }
      }

      if (store.activeChannel?.id === channelId) {
        store.setActive(store.channelsList[0]?.name ?? '');
      }
    });

    this.subscribed = true;
    console.log('Subscribed to events for:', this.namespace);
  }
  public async leaveChannel(): Promise<void> {
    if (!this.isJoined) return;

    console.log('Leaving channel:', this.namespace);

    await this.emitAsync('leaveChannel');
    this.isJoined = false;
    // this.socket.disconnect(); // Voliteľné, ak chceš úplne odpojiť socket
  }

  public async joinChannel(): Promise<unknown> {
    if (this.isJoined) {
      console.log('Already joined channel:', this.namespace);
      return { success: true }; // ← vráť niečo, aby sa nezaseklo
    }

    console.log('Sending joinChannel to:', this.namespace);
    const result = await this.emitAsync('joinChannel');
    this.isJoined = true; // ← označ, že si už v kanáli
    return result;
  }

  public async loadMessages(options?: LoadMessagesOptions): Promise<SerializedMessage[]> {
    // ✅ Používame typ, ktorý je definovaný a importovaný
    return this.emitAsync<SerializedMessage[]>('loadMessages', options || {});
  }

  public async addMessage(content: string): Promise<SerializedMessage> {
    console.log('Sending addMessage:', content);
    return this.emitAsync('addMessage', content);
  }
}

class ChannelService {
  private channels: Map<string, ChannelSocketManager> = new Map();

  // Normalizácia len na vyhľadávanie v mape
  private normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  public join(name: string): ChannelSocketManager {
    const normalized = this.normalize(name);

    // Ak už existuje (napr. "general" alebo "General"), vráť ho
    if (this.channels.has(normalized)) {
      const socket = this.channels.get(normalized)!;
      socket.join(); // ← už je subscribed, nič sa nestane
      return socket;
    }

    // Použi PÔVODNÝ názov do namespace (case-sensitive!)
    const socket = new ChannelSocketManager(`/channels/${name}`);
    this.channels.set(normalized, socket);
    return socket;
  }

  public in(name: string): ChannelSocketManager | undefined {
    return this.channels.get(this.normalize(name));
  }

  public leave(name: string): boolean {
    const normalized = this.normalize(name);
    const socket = this.channels.get(normalized);
    if (!socket) return false;

    socket.destroy();
    return this.channels.delete(normalized);
  }
  public removeInstance(namespace: string): void {
    const name = namespace.split('/').pop() as string;
    const normalized = this.normalize(name);

    // Predpokladáme, že sa to volá po disconnect(), takže len vymažeme z mapy
    this.channels.delete(normalized);
    console.log(`[ChannelService] Removed instance for ${normalized} from map.`);
  }
}

export default new ChannelService();
