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

export interface BanStatus {
  status: 'ok' | 'banned' | 'not_found';
  message?: string;
}

export interface LoadMessagesOptions {
  sinceId?: number;
}
export interface TypingPayload {
  typing: boolean;
  text?: string;
}

export class ChannelSocketManager extends SocketManager {
  private subscribed = false;
  public isJoined = false;

  //volame pri prvom join
  public join(params?: BootParams): this {
    if (params) {
      this.subscribe(); // zavola subscribe s Quasar boot params
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

  //----------------------------- INVITATION METHODS -----------------------------

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
    return this.emitAsync('deleteChannel', channelId);
  }

  public async checkBanStatus(channelName: string): Promise<BanStatus> {
    return this.emitAsync('checkBanStatus', channelName);
  }

  public async sendStatus(status: 'online' | 'offline'): Promise<{
    success: boolean;
    status: string;
  }> {
    console.log('Sending status via ChannelSocket:', status);
    return this.emitAsync('updateStatus', { status });
  }

  public async updateDnd(dnd: boolean) {
    console.log('Posielam DND na update: ', dnd);
    return this.emitAsync('updateDnd', { dnd });
  }

  public sendTyping(payload: TypingPayload): void {
    console.log('Sending typing:', payload.typing ? 'started' : 'stopped', 'text:', payload.text);
    this.socket.emit('typing', payload);
  }

  public async fetchAllStatuses(): Promise<void> {
    try {
      const response = await this.emitAsync('getAllStatuses', {});
      if (Array.isArray(response)) {
        const payload = response.map((u) => ({
          nickname: u.nickname,
          status: u.status,
        }));

        const { useStatusStore } = await import('src/stores/status');
        const statusStore = useStatusStore();
        statusStore.updateStatuses(payload);

        console.log('Fetched all user statuses:', payload);
      }
    } catch (err) {
      console.error('Failed to fetch all user statuses:', err);
    }
  }

  public async fetchAllDnds(): Promise<void> {
    try {
      const response = await this.emitAsync('getAllDnds', {});
      if (Array.isArray(response)) {
        const { useStatusStore } = await import('src/stores/status');
        const statusStore = useStatusStore();

        // aktualizuj vsetky DND naraz
        statusStore.updateDnds(response);

        console.log('Fetched all user DNDs:', response);
      }
    } catch (err) {
      console.error('Failed to fetch DNDs:', err);
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

    import('./ChannelService')
      .then((module) => {
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

    // zabranime duplikacii
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

    this.socket.off('members:update');
    this.socket.on('members:update', ({ channelId, members }) => {
      console.log('LIVE MEMBERS UPDATE:', channelId, members);

      const store = useChannelsStore();
      const ch = store.channelsList.find((c) => c.id === channelId);

      if (ch) {
        ch.members = members;
      }
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

    this.socket.on('channel:deleted', ({ channelId, channelName }) => {
      console.log('CHANNEL DELETED:', channelName);

      const store = useChannelsStore();
      const index = store.channelsList.findIndex((c) => c.id === channelId);

      if (index !== -1) {
        store.channelsList.splice(index, 1);

        // ak bol aktivny tento kanal, prepni na prvy dostupny
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
  }

  public async joinChannel(): Promise<unknown> {
    if (this.isJoined) {
      console.log('Already joined channel:', this.namespace);
      return { success: true };
    }

    console.log('Sending joinChannel to:', this.namespace);
    const result = await this.emitAsync('joinChannel');
    this.isJoined = true;
    return result;
  }

  public async loadMessages(options?: LoadMessagesOptions): Promise<SerializedMessage[]> {
    return this.emitAsync<SerializedMessage[]>('loadMessages', options || {});
  }

  public async addMessage(content: string): Promise<SerializedMessage> {
    console.log('Sending addMessage:', content);
    return this.emitAsync('addMessage', content);
  }
}

class ChannelService {
  private channels: Map<string, ChannelSocketManager> = new Map();

  private normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  public join(name: string): ChannelSocketManager {
    const normalized = this.normalize(name);

    // ak uz ecistuje, vrat ho
    if (this.channels.has(normalized)) {
      const socket = this.channels.get(normalized)!;
      socket.join();
      return socket;
    }

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

    this.channels.delete(normalized);
    console.log(`[ChannelService] Removed instance for ${normalized} from map.`);
  }
}

export default new ChannelService();
