<template>
  <q-page class="row no-wrap bg-secondary">
    <!-- Sidebar na lavo -->
    <div class="column items-center bg-secondary q-pa-md" :style="{ width: sidebarWidth }">
      <q-btn
        flat
        round
        icon="groups"
        :color="showChannels ? 'black' : 'primary'"
        :size="iconSize"
        class="q-mb-md"
        title="Channels"
        @click="toggleChannels"
      />
      <!-- Invitations -->
      <div class="relative-position q-mb-md">
        <q-btn
          flat
          round
          icon="mail"
          color="primary"
          :size="iconSize"
          title="Invitations"
          :disable="isOffline"
          @click="openInvitations"
        />
        <q-badge v-if="invitationCount > 0" color="red" floating transparent>
          {{ invitationCount }}
        </q-badge>
        <!-- ked je offline, upozorni -->
        <q-badge v-if="invitationCount > 0 && isOffline" color="grey-7" floating label="offline" />
      </div>
    </div>

    <!-- Hlavna cast chatu -->
    <div class="column col bg-white">
      <div class="row col">
        <ChannelListSide
          :show-channels="showChannels"
          :is-small-screen="isSmallScreen"
          :channels="filteredChannels"
          :active-channel="activeChannel"
          @update:show-channels="showChannels = $event"
          @update:channel-filter="channelFilter = $event"
          @select-channel="selectChannel"
          @open-create-channel-dialog="showCreateChannelDialog = true"
        />
        <!-- chatting -->
        <div class="column relative-position" style="flex: 1">
          <!-- obsah chatu -->
          <div v-if="activeChannel" class="column" style="flex: 1; overflow: hidden">
            <div class="q-pa-md row items-center justify-between">
              <div class="text-h6">
                {{ activeChannel?.name }}
              </div>
              <!-- menu: only if channel -->
              <div v-if="activeChannel">
                <q-btn flat round dense icon="more_vert">
                  <q-menu>
                    <q-list style="min-width: 150px">
                      <q-item
                        v-if="canInvitePeople"
                        clickable
                        v-close-popup
                        :disable="isOffline"
                        @click="showAddPeopleDialog = true"
                      >
                        <q-item-section>Invite people</q-item-section>
                      </q-item>
                      <q-item
                        v-if="canRemovePeople"
                        clickable
                        v-close-popup
                        :disable="isOffline"
                        @click="showRemovePeopleDialog = true"
                      >
                        <q-item-section>Remove people</q-item-section>
                      </q-item>
                      <q-item
                        v-if="canKickPeople"
                        clickable
                        v-close-popup
                        :disable="isOffline"
                        @click="showKickPeopleDialog = true"
                      >
                        <q-item-section>Kick people</q-item-section>
                      </q-item>
                      <q-item clickable :disable="isOffline" v-close-popup @click="leaveChannel">
                        <q-item-section>Leave channel</q-item-section>
                      </q-item>
                      <q-item
                        clickable
                        :disable="isOffline"
                        v-close-popup
                        @click="showMembersDialog = true"
                      >
                        <q-item-section>Members</q-item-section>
                      </q-item>
                      <q-item
                        v-if="activeChannel?.isAdmin"
                        clickable
                        v-close-popup
                        :disable="isOffline"
                        @click="openDeleteConfirm"
                      >
                        <q-item-section class="text-negative">Delete channel</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </div>
            <q-separator />
            <!-- messages -->
            <q-scroll-area
              ref="chatScrollArea"
              class="q-pl-md q-pr-md"
              style="flex: 1; display: flex; flex-direction: column"
            >
              <q-infinite-scroll @load="onLoadMore" :offset="250" reverse :disable="noMoreMessages">
                <div v-if="isLoadingMore" class="flex justify-center q-my-sm">
                  <q-spinner size="24px" color="primary" />
                </div>
                <div v-for="(msg, index) in visibleMessages" :key="msg.id" class="q-mb-sm">
                  <!-- nasa sprava je napravo a zlta -->
                  <div v-if="isMyMessage(msg)" class="row justify-end">
                    <div class="my-message q-pa-sm rounded-borders">
                      {{ msg.text }}
                    </div>
                  </div>

                  <!-- CUDZIA SPRAVA - NA LAVO -->
                  <div v-else class="row justify-start items-end q-gutter-sm">
                    <div
                      v-if="
                        index === visibleMessages.length - 1 ||
                        visibleMessages[index + 1].user !== msg.user
                      "
                      class="relative-position"
                    >
                      <ProfilePicture
                        :avatar="getUserByName(msg.user).avatar"
                        size="40px"
                        bgColor="grey-3"
                        class="q-mr-sm"
                      />
                      <div
                        class="status-indicator q-ml-sm"
                        :style="{ backgroundColor: getMemberStatusObj(msg.user).color }"
                      ></div>
                      <div v-if="getMemberDnd(msg.user)" class="dnd-emoji absolute-bottom-right">
                        🏖️
                      </div>
                    </div>
                    <div v-else style="width: 48px">
                      <!-- prazdny div na zarovnanie s avatarom -->
                    </div>
                    <div class="column items-start" style="flex: 1; min-width: 0">
                      <div
                        v-if="index === 0 || visibleMessages[index - 1].user !== msg.user"
                        class="text-caption text-grey-6 q-mb-xs"
                      >
                        {{ msg.user }}
                      </div>

                      <div
                        class="q-pa-sm rounded-borders transition-all"
                        :class="[
                          'other-message',
                          {
                            'mention-highlight': msg.isMentioned,
                            'mention-pulse': msg.isMentioned,
                          },
                        ]"
                      >
                        {{ msg.text }}
                      </div>
                    </div>
                  </div>
                </div>
              </q-infinite-scroll>
            </q-scroll-area>
            <!-- dynamicky typing indikator -->
            <div
              v-if="hasTypingUsers"
              class="q-pl-md q-pr-md q-mb-sm cursor-pointer"
              @click="showTypingUsersDialog = true"
            >
              <div class="row items-center no-wrap">
                <!-- AVATARY max 3-->
                <div class="typing-avatars">
                  <ProfilePicture
                    v-for="(user, index) in typingAvatars"
                    :key="user.nickname"
                    :avatar="user.avatar"
                    size="32px"
                    bgColor="grey-3"
                    class="typing-avatar"
                    :style="{ zIndex: 10 - index }"
                  />
                </div>

                <!-- TRI BODKY -->
                <div class="typing-dots q-ml-sm"><span></span><span></span><span></span></div>
              </div>
            </div>
          </div>
          <!-- ak nie je vybrate nic -->
          <div v-else class="flex flex-center col text-grey" style="flex: 1; text-align: center">
            <div>Select a channel or friend to start chatting</div>
          </div>
          <!-- fixny riadok na pisanie -->
          <div
            class="column bg-grey-2"
            style="position: sticky; bottom: 0; border-top: 1px solid #444"
          >
            <div
              ref="alertBox"
              class="system-message"
              style="
                height: 25px;
                padding: 6px 12px;
                font-family: monospace;
                font-size: 14px;
                color: #222;
              "
            >
              {{ systemMessage }}
            </div>
            <!-- command line -->
            <div class="row q-pa-sm bg-grey-2" style="position: sticky; bottom: 0">
              <q-input
                ref="cliInput"
                v-model="newMessage"
                placeholder="Enter a message or command"
                input-class="command-input"
                outlined
                dense
                :disable="isOffline"
                maxlength="1000"
                class="col"
                @keyup.enter="sendMessage"
                @input="handleTyping"
                @focus="handleTypingStart"
                @blur="handleTypingStop"
              />
              <q-btn color="primary" label="Send" class="q-ml-sm" @click="sendMessage" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <q-dialog v-model="showInvitationsDialog">
      <q-card style="width: 350px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Invitations</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-list bordered separator>
          <q-item v-for="invite in invitations" :key="invite.id">
            <q-item-section>
              {{ invite.from }} invited you to {{ invite.channelName }}
              <span class="text-grey-6">({{ invite.channelType }})</span>
            </q-item-section>
            <q-item-section side>
              <q-btn dense flat color="primary" label="Accept" @click="acceptInvite(invite)" />
              <q-btn dense flat color="black" label="Decline" @click="declineInvite(invite)" />
            </q-item-section>
          </q-item>

          <q-item v-if="invitations.length === 0">
            <q-item-section>No invitations yet</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <!-- create channel -->
    <q-dialog v-model="showCreateChannelDialog">
      <q-card style="width: 400px">
        <q-card-section>
          <div class="text-h6">Create Channel</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newChannelName"
            label="Channel name"
            outlined
            dense
            maxlength="20"
            autofocus
          />

          <div class="relative-position q-mt-md">
            <q-select
              v-model="selectedNicknames"
              multiple
              use-input
              use-chips
              input-debounce="0"
              new-value-mode="add-unique"
              label="Invite people (type nicknames)"
              outlined
              dense
              class="q-mt-md"
              hint="Press Enter after each nickname"
              @new-value="checkUnique"
            />
            <div v-if="invalidNicknamesError" class="text-negative text-caption q-mt-xs q-pl-sm">
              {{ invalidNicknamesError }}
            </div>
          </div>

          <q-select
            v-model="newChannelType"
            :options="[
              { label: 'Public', value: 'public' },
              { label: 'Private', value: 'private' },
            ]"
            label="Channel type"
            outlined
            dense
            class="q-mt-md"
            emit-value
            map-options
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Create" color="primary" @click="createChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- pridaj/delete ludi z kanalov -->
    <q-dialog v-model="showAddPeopleDialog">
      <q-card style="width: 400px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Invite people to {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <div class="relative-position q-mt-md">
            <q-select
              v-model="selectedNicknames"
              multiple
              use-input
              use-chips
              input-debounce="0"
              new-value-mode="add-unique"
              label="Invite people (type nicknames)"
              outlined
              dense
              class="q-mt-md"
              hint="Press Enter after each nickname"
              @new-value="checkUnique"
            />
            <div v-if="invalidNicknamesError" class="text-negative text-caption q-mt-xs q-pl-sm">
              {{ invalidNicknamesError }}
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Add" color="primary" @click="addPeopleToChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showRemovePeopleDialog">
      <q-card style="width: 400px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Remove people from {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="selectedNicknames"
            multiple
            :options="getChannelMembers()"
            label="Select members to remove"
            outlined
            dense
            use-chips
            emit-value
            map-options
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Remove" color="primary" @click="removePeopleFromChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <!-- zoznam clenov kanala -->
    <q-dialog v-model="showMembersDialog">
      <q-card style="min-width: 300px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Members of {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section style="max-height: 300px; overflow-y: auto">
          <!-- toto je scrolling -->
          <q-list bordered separator>
            <q-item v-for="member in channelMembers" :key="member.id">
              <q-item-section>
                <div class="row items-center">
                  <div class="relative-position">
                    <ProfilePicture
                      :avatar="member.avatar"
                      size="40px"
                      bgColor="grey-3"
                      class="q-mr-sm"
                    />
                    <div
                      class="status-indicator q-ml-sm"
                      :style="{ backgroundColor: getMemberStatusObj(member.name).color }"
                    ></div>
                  </div>
                  <span>{{ member.name }}</span>
                </div>
              </q-item-section>
            </q-item>

            <q-item v-if="!channelMembers.length">
              <q-item-section>No members in this channel</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="black" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showDeleteConfirm">
      <q-card style="min-width: 300px">
        <q-card-section class="text-center">
          Are you sure you want to delete channel "{{ channelToDelete?.name }}"?
          <div class="text-caption text-grey-7 q-mt-sm">This action cannot be undone.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn color="primary" label="Delete" @click="deleteChannelViaSocket" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showLeaveConfirm">
      <q-card style="min-width: 300px">
        <q-card-section class="text-center">
          Are you sure you want to leave channel "{{ channelToLeave?.name }}"?
          <div
            v-if="(channelToLeave?.members?.length || 0) <= 1"
            class="text-caption text-warning q-mt-sm"
          >
            <q-icon name="warning" /> You are the last member. This channel will be deleted.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn color="primary" label="Leave" @click="confirmLeaveChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showKickPeopleDialog">
      <q-card style="width: 400px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Vote to kick from {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="selectedNicknames"
            multiple
            :options="getChannelMembers()"
            label="Select members to vote kick"
            outlined
            dense
            use-chips
            emit-value
            map-options
          />
          <div class="text-caption text-grey-7 q-mt-sm">
            3 votes needed to ban a member permanently
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Vote Kick" color="warning" @click="kickPeopleFromChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- typing users dialog -->
    <q-dialog
      v-model="showTypingUsersDialog"
      position="standard"
      @hide="selectedTypingMember = null"
    >
      <q-card style="min-width: 300px; max-width: 360px">
        <q-card-section class="row items-center justify-between q-pb-sm">
          <q-btn
            v-if="selectedTypingMember"
            flat
            dense
            round
            icon="arrow_back"
            @click="selectedTypingMember = null"
            class="q-mr-sm"
          />
          <div class="text-subtitle1">
            <span v-if="!selectedTypingMember">
              Currently typing
              <span class="text-grey-6 q-ml-xs"> ({{ typingMembers.length }}) </span>
            </span>
          </div>
          <q-btn flat dense round icon="close" v-close-popup />
        </q-card-section>

        <q-separator />

        <q-card-section style="max-height: 280px; overflow-y: auto">
          <!-- zoznam typing users -->
          <q-list v-if="!selectedTypingMember" separator>
            <q-item
              clickable
              @click="selectedTypingMember = member"
              v-for="member in typingMembers"
              :key="member.id"
              v-ripple
            >
              <q-item-section avatar>
                <div class="relative-position">
                  <ProfilePicture :avatar="member.avatar" size="40px" bgColor="grey-3" />
                  <div
                    class="status-indicator"
                    :style="{ backgroundColor: getMemberStatusObj(member.name).color }"
                  />
                </div>
              </q-item-section>

              <q-item-section>
                <div class="text-body1">{{ member.name }}</div>
                <div class="text-caption text-grey-6">typing…</div>
              </q-item-section>
            </q-item>

            <!-- ked nikto nepise -->
            <q-item v-if="!typingMembers.length">
              <q-item-section class="text-grey-6 text-center">
                Nobody is typing right now
              </q-item-section>
            </q-item>
          </q-list>

          <!-- detail selected typing user -->
          <div v-else>
            <div class="text-body1 q-mb-sm">{{ selectedTypingMember.name }}</div>
            <div class="q-pa-sm bg-grey-2 rounded-borders" style="white-space: pre-wrap">
              {{ selectedTypingMember.typingText }}
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch, onUnmounted } from 'vue';
import { useQuasar } from 'quasar';
import ProfilePicture from '../components/ProfilePicture.vue';
import ChannelListSide from '../components/ChannelListSide.vue';
import type { QScrollArea } from 'quasar';
import type { Channel } from 'src/types/channel';
import channelService from 'src/services/ChannelService';
import { useInvitationsStore } from 'src/stores/invitations';
import type { Invitation } from 'src/types/invitation';
import { statusMap } from 'src/types/UserStatus';

import { api } from 'src/boot/axios';
import { useChannelsStore } from 'src/stores/channels';
import { useStatusStore } from 'src/stores/status';

const statusStore = useStatusStore();
type UserStatus = 'online' | 'dnd' | 'offline';

interface User {
  id: number;
  name: string;
  avatar: string;
  status: UserStatus;
  messages?: Message[];
}

interface Message {
  id: number;
  user: string;
  text: string;
}

const getMemberDnd = computed(() => (nickname: string) => {
  return statusStore.userDnds[nickname] ?? false;
});

const isOffline = computed(() => statusStore.myStatus === 'offline');

const getMemberStatusObj = (memberName: string) => {
  const key = statusStore.userStatuses[memberName] ?? 'online';
  return statusMap[key] || statusMap.online;
};

const channelMembers = computed(() => {
  return channelsStore.activeChannelMembers.map((m) => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    status: 'online' as UserStatus,
  }));
});

const $q = useQuasar();
const isSmallScreen = computed(() => $q.screen.width < 700);

// responzivny lavy sidebar width
const sidebarWidth = computed(() => {
  if ($q.screen.xl) return '120px';
  if ($q.screen.lg) return '100px';
  if ($q.screen.md) return '80px';
  if ($q.screen.sm) return '80px';
  return '60px';
});

// responzivna velkost ikon sidebar quasar velkosti
const iconSize = computed(() => {
  if ($q.screen.xl) return 'xl';
  if ($q.screen.lg) return 'lg';
  if ($q.screen.md) return 'md';
  if ($q.screen.sm) return 'md';
  return 'sm';
});

// zobrazenie channel a friends listu
const showChannels = ref(true);
const showFriends = ref(false);
const channels = computed(() => channelsStore.channelsList);
const activeChannel = computed(() => channelsStore.activeChannel);
const channelFilter = ref<'all' | 'public' | 'private'>('all');

const toggleChannels = () => {
  showChannels.value = !showChannels.value;
  if (showChannels.value) showFriends.value = false;
};

const users = ref<User[]>([]);

const fetchUsers = async () => {
  try {
    const response = await api.get('/api/users');
    users.value = response.data;
  } catch (error) {
    console.error('Failed to fetch users:', error);
  }
};

const getUserByName = (name: string): User => {
  return (
    users.value.find((u) => u.name === name) || {
      id: -1,
      name,
      avatar: '',
      status: 'offline' as const,
    }
  );
};

const newChannelType = ref<'public' | 'private'>('public');

const channelsStore = useChannelsStore();
const currentMessages = computed(() => {
  if (!activeChannel.value) return [];
  return channelsStore.messages[activeChannel.value.name] || [];
});

const showInvitationsDialog = ref(false);
const showCreateChannelDialog = ref(false);
const showAddPeopleDialog = ref(false);
const showRemovePeopleDialog = ref(false);
const showMembersDialog = ref(false);
const newChannelName = ref('');
const selectedNicknames = ref<string[]>([]);

const checkUnique = (
  //chekuje ci je chips unique
  val: string,
  done: (item?: string, mode?: 'toggle' | 'add' | 'add-unique') => void,
) => {
  if (val.length > 0) {
    done(val, 'add-unique');
  }
};

// tu je efektivny scroll
const isLoadingMore = ref(false);
const loadedMessagesCount = ref(20); //batch mame na 20 sprav
const chatScrollArea = ref<QScrollArea | null>(null);
const batchSize = 10;

const visibleMessages = computed(() => {
  if (!activeChannel.value) return [];
  const msgs = currentMessages.value || [];
  return msgs.slice(-loadedMessagesCount.value); //ukaze nam tych poslednych 20
});

//uz mame nacitane vsetko
const noMoreMessages = computed(() => {
  return loadedMessagesCount.value >= (currentMessages.value?.length || 0);
});

const onLoadMore = async (index: number, done: (stop?: boolean) => void) => {
  if (noMoreMessages.value) {
    done(true); // zastav infinite scroll
    return;
  }

  isLoadingMore.value = true;
  await new Promise((resolve) => setTimeout(resolve, 1200)); // simulacia nacitavania s kolieckom
  loadedMessagesCount.value += batchSize;
  isLoadingMore.value = false;
  done();
};

const scrollToBottom = async () => {
  await nextTick();
  if (!chatScrollArea.value) return;
  const target = chatScrollArea.value.getScrollTarget();
  target.scrollTop = target.scrollHeight;
};

const selectChannel = async (ch: Channel) => {
  channelsStore.setActive(ch.name);
  const socket = channelService.join(ch.name);

  const hasMessages = channelsStore.messages[ch.name]?.length > 0;
  if (statusStore.myStatus === 'offline') {
    systemMessage.value = 'You have to be online to join this channel';
    return;
  }

  if (socket.isJoined) {
    if (!hasMessages) {
      const messages = await socket.loadMessages();
      messages.forEach((m) => channelsStore.newMessage(ch.name, m));
    }
    await nextTick();
    await scrollToBottom();
    if (isSmallScreen.value) showChannels.value = false;
    return;
  }

  // inak join + load messages
  try {
    await socket.joinChannel();
    const messages = await socket.loadMessages();
    messages.forEach((m) => channelsStore.newMessage(ch.name, m));
  } catch (err) {
    systemMessage.value = 'Failed to join channel';
    console.error(err);
    return;
  }

  if (isSmallScreen.value) showChannels.value = false;
  await nextTick();
  await scrollToBottom();
};

const canInvitePeople = computed(() => {
  if (!activeChannel.value) return false;

  // public channels: anyone can invite
  if (activeChannel.value.type === 'public') return true;

  // private channels: only admin can invite
  return activeChannel.value.isAdmin;
});

const canRemovePeople = computed(() => {
  if (!activeChannel.value) return false;
  return activeChannel.value.isAdmin;
});

const canKickPeople = computed(() => {
  if (!activeChannel.value) return false;

  // only in public channels AND you are not admin
  return activeChannel.value.type === 'public' && !activeChannel.value.isAdmin;
});

const invitationsStore = useInvitationsStore();
const invitationCount = computed(() => invitationsStore.count);
const invitations = computed(() => invitationsStore.list);

const openInvitations = () => {
  showInvitationsDialog.value = true;
};

const acceptInvite = async (invitation: Invitation) => {
  await invitationsStore.accept(invitation);

  const channelName = invitation.channelName;
  channelsStore.setActive(channelName);

  // nacitaj historiu sprav
  const socket = channelService.join(channelName);
  if (!socket.isJoined) await socket.joinChannel();

  const messages = await socket.loadMessages();
  messages.forEach((m) => channelsStore.newMessage(channelName, m));

  await nextTick();
  await scrollToBottom();

  showInvitationsDialog.value = false;
};

const declineInvite = async (invitation: Invitation) => {
  await invitationsStore.decline(invitation);
};
// na filtrovanie v tych side baroch channel
const filteredChannels = computed(() => {
  if (channelFilter.value === 'all') return channels.value;
  return channels.value.filter((ch) => ch.type === channelFilter.value);
});

const invalidNicknamesError = ref('');

const createChannel = async () => {
  const name = newChannelName.value.trim();
  if (!name) return;

  invalidNicknamesError.value = '';

  const nameExists = channels.value.some((ch) => ch.name.toLowerCase() === name.toLowerCase());
  if (nameExists) {
    alert('Channel name already exists!');
    return;
  }

  const myNickname = authStore.user?.nickname; //nech sa neinvituje sam seba
  if (myNickname && selectedNicknames.value.includes(myNickname)) {
    invalidNicknamesError.value = 'You cannot invite yourself';
    return;
  }

  // VALIDATE NICKNAMES FIRST
  if (selectedNicknames.value.length > 0) {
    try {
      const response = await api.post('/auth/validate-nicknames', {
        nicknames: selectedNicknames.value,
      });

      const invalidNicknames = response.data.invalidNicknames;
      if (invalidNicknames && invalidNicknames.length > 0) {
        invalidNicknamesError.value = `These users don't exist: ${invalidNicknames.join(', ')}`;
        return;
      }
    } catch (err) {
      console.error('Failed to validate nicknames:', err);
      invalidNicknamesError.value = 'Failed to validate nicknames';
      return;
    }
  }

  // (only if nicknames are valid) vytvor channel
  try {
    const response = await api.post('/api/channels', {
      name,
      type: newChannelType.value,
      nicknames: selectedNicknames.value,
    });

    channelsStore.channelsList.unshift(response.data);
    channelsStore.setActive(response.data.name);

    // join cez WebSocket
    const socket = channelService.join(response.data.name);

    if (!socket.socket.connected) {
      await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
    }

    try {
      await socket.joinChannel();
      systemMessage.value = `Created channel ${response.data.name}`;
      try {
        await socket.inviteUsers(selectedNicknames.value);
        console.log('Sending invites to', selectedNicknames.value);
      } catch (err) {
        console.error(`Failed to invite users`, err);
      }
    } catch (err) {
      systemMessage.value = 'Failed to create channel';
      console.error(err);
    }

    try {
      const messages = await socket.loadMessages();
      messages.forEach((m) => channelsStore.newMessage(response.data.name, m));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }

    // reset
    newChannelName.value = '';
    selectedNicknames.value = [];
    newChannelType.value = 'public';
    showCreateChannelDialog.value = false;

    await nextTick();
    await scrollToBottom();
  } catch (err: unknown) {
    console.error('Failed to create channel:', err);
    alert('Failed to create channel');
  }
};

const showLeaveConfirm = ref(false);
const channelToLeave = ref<Channel | null>(null);

const leaveChannel = () => {
  if (!activeChannel.value) return;

  channelToLeave.value = activeChannel.value;
  showLeaveConfirm.value = true;
};

const confirmLeaveChannel = async () => {
  if (!channelToLeave.value) return;

  const channelName = channelToLeave.value.name;
  const socket = channelService.in(channelName);

  try {
    // vzdy chod cez WebSocket – aj v private
    if (socket && socket.isJoined) {
      await socket.leaveChannel();
    } else {
      // ak z nejakeho dovodu nie je pripojeny – pripoj sa a odid
      const tempSocket = channelService.join(channelName);
      if (!tempSocket.socket.connected) {
        await new Promise<void>((resolve) => tempSocket.socket.once('connect', resolve));
      }
      await tempSocket.joinChannel();
      await tempSocket.leaveChannel();
    }

    await channelsStore.fetchChannels(); // len refresh zoznamu
    channelsStore.setActive(channelsStore.channelsList[0]?.name ?? '');

    systemMessage.value = 'Left channel successfully';
  } catch (error) {
    console.error('Failed to leave:', error);
    systemMessage.value = 'Failed to leave channel';
  } finally {
    showLeaveConfirm.value = false;
    channelToLeave.value = null;
  }
};

watch(
  () => channelsStore.activeChannelMembers,
  (newMembers) => {
    console.log('Active channel members updated:', newMembers.length);
  },
  { deep: true },
);

const showDeleteConfirm = ref(false);
const channelToDelete = ref<Channel | null>(null);

const openDeleteConfirm = () => {
  if (!activeChannel.value?.isAdmin) return;
  channelToDelete.value = activeChannel.value;
  showDeleteConfirm.value = true;
};

const deleteChannelViaSocket = async () => {
  if (!activeChannel.value?.isAdmin) return;

  const channel = activeChannel.value;

  const socket = channelService.in(channel.name);
  if (!socket) {
    systemMessage.value = 'Not connected to channel';
    return;
  }

  try {
    await socket.deleteChannel(channel.id);
    systemMessage.value = 'Channel deleted...';
    // dalej vsetko urobi event channel:deleted - dynamicky sa vsetkym kanal zmaze
  } catch (err) {
    console.error('Failed to delete channel:', err);
    systemMessage.value = 'Failed to close channel';
  }
  showDeleteConfirm.value = false;
  channelToDelete.value = null;
};

const getChannelMembers = () => {
  const myId = authStore.user?.id;
  return channelMembers.value
    .filter((m) => m.id !== myId) // skryjem seba
    .map((m) => ({
      label: m.name,
      value: m.name,
    }));
};

const showKickPeopleDialog = ref(false);

const kickPeopleFromChannel = async () => {
  if (!activeChannel.value) return;

  const nicknamesToKick = selectedNicknames.value.map((n) => n);
  console.log('Nickname to kick', nicknamesToKick);

  for (const nickname of nicknamesToKick) {
    try {
      const response = await api.post(`/api/channels/${activeChannel.value.id}/kick`, { nickname });

      systemMessage.value = response.data.message;

      if (response.data.banned) {
        await channelsStore.fetchChannels();
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      systemMessage.value = axiosError.response?.data?.error || `Failed to kick ${nickname}`;
    }
  }

  showKickPeopleDialog.value = false;
  selectedNicknames.value = [];
};

const addPeopleToChannel = async () => {
  if (!activeChannel.value) return;
  invalidNicknamesError.value = '';

  const myNickname = authStore.user?.nickname; //nech sa neinvituje sam seba
  if (myNickname && selectedNicknames.value.includes(myNickname)) {
    invalidNicknamesError.value = 'You cannot invite yourself';
    return;
  }

  // VALIDATE NICKNAMES FIRST
  if (selectedNicknames.value.length > 0) {
    try {
      const response = await api.post('/auth/validate-nicknames', {
        nicknames: selectedNicknames.value,
      });

      const invalidNicknames = response.data.invalidNicknames;
      if (invalidNicknames && invalidNicknames.length > 0) {
        invalidNicknamesError.value = `These users don't exist: ${invalidNicknames.join(', ')}`;
        return;
      }
    } catch (err) {
      console.error('Failed to validate nicknames:', err);
      invalidNicknamesError.value = 'Failed to validate nicknames';
      return;
    }
  }

  const socket = channelService.in(activeChannel.value.name);
  if (!socket) {
    console.error('No socket connected to this channel!');
    return;
  }

  try {
    await socket.inviteUsers(selectedNicknames.value);
    console.log('Sending invites to', selectedNicknames.value);
  } catch (err) {
    console.error('Failed to invite users', err);
  }
  showAddPeopleDialog.value = false;
  selectedNicknames.value = [];
};

const removePeopleFromChannel = async () => {
  if (!activeChannel.value) return;
  if (selectedNicknames.value.length === 0) return;

  const nicknamesToKick = selectedNicknames.value.map((n) => n);
  console.log('Nickname to kick', nicknamesToKick);

  for (const nickname of nicknamesToKick) {
    const socket = channelService.in(activeChannel.value.name);
    if (!socket) {
      console.error('No socket connected to this channel!');
      return;
    }

    try {
      await socket.revokeUser(nickname);
      console.log('Removed user', nickname);
    } catch (err) {
      console.error('Failed to remove users', err);
    }
  }
  showRemovePeopleDialog.value = false;
  selectedNicknames.value = [];
};

// CLI fixne
const newMessage = ref('');
const systemMessage = ref('');

onMounted(async () => {
  await invitationsStore.loadInitial();

  // pocuvaj invites
  window.addEventListener('invitation:received', ((e: CustomEvent<Invitation>) => {
    invitationsStore.add(e.detail);
  }) as EventListener);

  window.addEventListener('user:removed', ((e: CustomEvent) => {
    const { channelName, removedBy } = e.detail;
    systemMessage.value = `You were removed from ${channelName} by ${removedBy}`;

    // refresh channels
    void channelsStore.fetchChannels();
  }) as EventListener);

  try {
    await authStore.check();
    await fetchUsers();
    await channelsStore.fetchChannels();

    // obnov posledny aktivny kanal
    const lastChannelName = localStorage.getItem('lastActiveChannel');
    console.log('Last active channel from storage:', lastChannelName);
    const lastChannelExists =
      lastChannelName && channelsStore.channelsList.some((ch) => ch.name === lastChannelName);

    if (lastChannelExists) {
      channelsStore.setActive(lastChannelName);
    } else if (channelsStore.channelsList.length > 0) {
      channelsStore.setActive(channelsStore.channelsList[0].name);
    }

    // znova sa pripoj do kanala, toto uz nahra aj spravy
    await channelsStore.rejoinActiveChannel();
  } catch (err) {
    console.error('Init failed:', err);
  }
});

// po zmene kanala
watch(
  activeChannel,
  async (newChannel) => {
    if (!newChannel) return;

    // uloz posledny aktivny kanal
    localStorage.setItem('lastActiveChannel', newChannel.name);

    // reset scroll a batch
    isLoadingMore.value = false;
    loadedMessagesCount.value = 20;

    await nextTick();
    await scrollToBottom();
  },
  { immediate: true },
);

// aby sa nam input na vytvorenie channel resetoval po kliknuti na cencel alebo mimo dialogu
watch(showCreateChannelDialog, (newVal) => {
  if (!newVal) {
    newChannelName.value = '';
    selectedNicknames.value = []; //  reset nicknames
    newChannelType.value = 'public';
    invalidNicknamesError.value = '';
  }
});

watch(selectedNicknames, () => {
  invalidNicknamesError.value = '';
});

import { useAuthStore } from 'src/stores/auth';
import type { DisplayMessage } from 'src/types/message';
import type { SerializedMessage } from 'src/contracts';

const authStore = useAuthStore();

const isMyMessage = (msg: DisplayMessage) => {
  const myName = authStore.user?.nickname;
  return msg.user === myName;
};

const sendMessage = async () => {
  const text = newMessage.value.trim();
  if (!text) return;

  try {
    // ────────────────────────────── COMMANDS ──────────────────────────────
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ');
      const command = parts[0]?.toLowerCase() ?? '';

      // join
      if (command === 'join') {
        const inputName = parts[1]?.trim();
        if (!inputName) {
          systemMessage.value = 'Usage: /join channelName [private]';
          newMessage.value = '';
          return;
        }

        // fetch ALL channels from DB
        const allChannels = await channelsStore.fetchAllChannels();

        // check if channel exists in DB
        const existingChannel = allChannels.find(
          (c: Channel) => c.name.toLowerCase() === inputName.toLowerCase(),
        );

        if (existingChannel) {
          // channel existuje a je private
          if (existingChannel.type === 'private') {
            systemMessage.value = `"${existingChannel.name}" is a private channel. Only admins can invite you.`;
            newMessage.value = '';
            return;
          }

          //check ci ma user ban na channel
          try {
            const manager = channelService.join('General');
            const banStatus = await manager.checkBanStatus(inputName);

            if (banStatus.status === 'banned') {
              systemMessage.value =
                banStatus.message || `You are banned from channel "${inputName}".`;
              newMessage.value = '';
              return; //Ban existuje, nepovolime
            }
          } catch (error) {
            // Ak zlyhá Socket, nemali by sme povoliť join
            console.error('Failed to check ban status:', error);
            systemMessage.value = 'Failed to check channel status due to connectivity error.';
            newMessage.value = '';
            return;
          }

          // channel existuje a je public - pripoj sa
          const socket = channelService.join(existingChannel.name);
          if (!socket.socket.connected) {
            await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
          }
          try {
            await socket.joinChannel();
            systemMessage.value = `Joined ${existingChannel.name}`;
          } catch (err) {
            systemMessage.value = 'Failed to join channel';
            console.error(err);
            newMessage.value = '';
            return;
          }

          try {
            const messages = await socket.loadMessages();
            messages.forEach((m) => channelsStore.newMessage(existingChannel.name, m));

            // refresh channel list usera
            await channelsStore.fetchChannels();

            // bude topovany
            const channelIndex = channelsStore.channelsList.findIndex(
              (c) => c.name === existingChannel.name,
            );
            if (channelIndex > 0) {
              const [channel] = channelsStore.channelsList.splice(channelIndex, 1);
              channelsStore.channelsList.unshift(channel);
            }

            // dame ho na active
            channelsStore.setActive(existingChannel.name);
          } catch (err) {
            systemMessage.value = 'You are not a member';
            console.error(err);
          }

          await nextTick();
          await scrollToBottom();
          newMessage.value = '';
          return;
        }

        // channel neexistuje - vytvor ho
        const type: 'public' | 'private' = parts
          .slice(2)
          .join(' ')
          .toLowerCase()
          .includes('private')
          ? 'private'
          : 'public';

        try {
          const response = await api.post('/api/channels', {
            name: inputName,
            type: type,
            memberIds: [],
          });

          // pridaj do store
          channelsStore.channelsList.unshift(response.data);
          channelsStore.setActive(response.data.name);
          systemMessage.value = `Channel "${inputName}" created (${type})`;

          // pripoj sa cez websocket
          const socket = channelService.join(response.data.name);
          if (!socket.socket.connected) {
            await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
          }
          try {
            await socket.joinChannel();
          } catch (err) {
            systemMessage.value = 'Failed to join channel';
            console.error(err);
            newMessage.value = '';
            return;
          }

          // load messages
          try {
            const messages = await socket.loadMessages();
            messages.forEach((m) => channelsStore.newMessage(response.data.name, m));
          } catch (err) {
            systemMessage.value = 'You are not a member';
            console.error(err);
          }

          await nextTick();
          await scrollToBottom();
          newMessage.value = '';
          return;
        } catch (err: unknown) {
          console.error('Failed to create channel:', err);
          systemMessage.value = 'Failed to create channel';
          newMessage.value = '';
          return;
        }
      }

      if (channelsStore.channelsList.length === 0) {
        systemMessage.value = 'You need to join or create a channel first. Try: /join General';
        newMessage.value = '';
        return;
      }

      if (command === 'list') {
        showMembersDialog.value = true;
        newMessage.value = '';
        return;
      } else if (command === 'cancel') {
        if (!activeChannel.value) {
          systemMessage.value = 'No active channel';
          newMessage.value = '';
          return;
        }

        const currentChannel = activeChannel.value;

        // ADMIN maze kanal pre vsetkych
        if (currentChannel.isAdmin) {
          const socket = channelService.in(currentChannel.name);
          if (!socket) {
            systemMessage.value = 'Not connected to channel';
            newMessage.value = '';
            return;
          }

          try {
            await socket.deleteChannel(currentChannel.id);
            systemMessage.value = 'Channel closed by admin';
          } catch (error) {
            const err = error as Error;
            systemMessage.value = err.message || 'Failed to delete channel';
            console.error('Delete channel error:', err);
          }
        } else {
          // nie sme ADMIN len odideme
          channelToLeave.value = activeChannel.value;
          await confirmLeaveChannel();
        }
        newMessage.value = '';
        return;
      } else if (command === 'quit') {
        if (!activeChannel.value) {
          systemMessage.value = 'No active channel';
          newMessage.value = '';
          return;
        }
        const currentChannel = activeChannel.value;

        if (!currentChannel.isAdmin) {
          systemMessage.value = 'Only admin can close the channel';
          newMessage.value = '';
          return;
        }

        const socket = channelService.in(currentChannel.name);
        if (!socket) {
          systemMessage.value = 'Not connected to channel';
          newMessage.value = '';
          return;
        }

        try {
          await socket.deleteChannel(currentChannel.id);
          systemMessage.value = 'Channel has been closed';
        } catch (err) {
          console.error('Failed to delete channel:', err);
          systemMessage.value = 'Failed to close channel';
        }

        newMessage.value = '';
        return;
      } else if (command === 'kick') {
        const nickname = parts[1]?.trim();
        if (!nickname) {
          systemMessage.value = 'Usage: /kick nickname';
          newMessage.value = '';
          return;
        }

        if (!activeChannel.value) {
          systemMessage.value = 'No active channel';
          newMessage.value = '';
          return;
        }

        if (activeChannel.value.type !== 'public') {
          systemMessage.value = 'Kick voting only works in public channels';
          newMessage.value = '';
          return;
        }

        try {
          const response = await api.post(`/api/channels/${activeChannel.value.id}/kick`, {
            nickname: nickname,
          });

          systemMessage.value = response.data.message;

          if (response.data.banned) {
            await channelsStore.fetchChannels();
          }
        } catch (error: unknown) {
          const axiosError = error as { response?: { data?: { error?: string } } };
          systemMessage.value = axiosError.response?.data?.error || 'Failed to kick user';
        }

        newMessage.value = '';
        return;
      } else if (command === 'invite') {
        if (!activeChannel.value) {
          systemMessage.value = 'Please select a channel first';
          newMessage.value = '';
          return;
        }

        const nickname = parts[1]?.trim();
        if (!nickname) {
          systemMessage.value = 'Usage: /invite nickname';
          newMessage.value = '';
          return;
        }

        try {
          const socket = channelService.in(activeChannel.value.name);
          if (!socket) {
            systemMessage.value = 'Not connected to channel';
            newMessage.value = '';
            return;
          }

          const result = await socket.inviteUsers([nickname]);

          if (result.invitationsSent > 0) {
            systemMessage.value = `Invitation sent to ${nickname}`;
          } else {
            systemMessage.value = `Could not invite ${nickname} (already member or invited)`;
          }
        } catch (err) {
          console.error('Failed to invite:', err);
          systemMessage.value = 'Failed to send invitation';
        }

        newMessage.value = '';
        return;
      }

      // revoke command
      if (command === 'revoke') {
        if (!activeChannel.value) {
          systemMessage.value = 'Please select a channel first';
          newMessage.value = '';
          return;
        }

        // check ci si admin - pre private channels
        if (activeChannel.value.type === 'private' && !activeChannel.value.isAdmin) {
          systemMessage.value = 'Only admin can remove users from private channels';
          newMessage.value = '';
          return;
        }

        const nickname = parts[1]?.trim();
        if (!nickname) {
          systemMessage.value = 'Usage: /revoke nickname';
          newMessage.value = '';
          return;
        }

        try {
          const socket = channelService.in(activeChannel.value.name);
          if (!socket) {
            systemMessage.value = 'Not connected to channel';
            newMessage.value = '';
            return;
          }

          const result = await socket.revokeUser(nickname);
          systemMessage.value = result.message || `${nickname} removed from channel`;
        } catch (err) {
          console.error('Failed to revoke:', err);
          systemMessage.value = 'Failed to remove user';
        }

        newMessage.value = '';
        return;
      } else {
        systemMessage.value = 'Unknown command: ' + text;
        newMessage.value = '';
        return;
      }
    }

    // ────────────────────────────── NORMAL MESSAGES ──────────────────────────────
    // ak user nepatri este do nijakeho kanala
    if (channelsStore.channelsList.length === 0) {
      systemMessage.value = 'You need to join or create a channel first. Try: /join General';
      newMessage.value = '';
      return;
    }

    // ak ma kanaly ale nema ziadny aktivny
    if (!activeChannel.value) {
      systemMessage.value = 'Please select a channel first (or type /join <name>)';
      newMessage.value = '';
      return;
    }

    // mame aktivny channel
    const channelName = activeChannel.value.name;

    if (statusStore.myStatus === 'offline') {
      systemMessage.value = 'Cannot send message: You are currently offline.';
      newMessage.value = '';
      return;
    }

    const socket = channelService.in(channelName);
    if (!socket) {
      systemMessage.value = 'Channel connection not initialized. Please try reloading.';
      newMessage.value = '';
      return;
    }

    const tempId = Date.now();
    const store = useChannelsStore();

    store.newMessage(channelName, {
      id: tempId,
      createdBy: authStore.user!.id,
      content: text,
      channelId: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: authStore.user!.id,
        email: authStore.user!.email,
        nickname: authStore.user?.nickname,
      },
    } as SerializedMessage);

    await nextTick();
    await scrollToBottom();
    systemMessage.value = '';

    try {
      await Promise.resolve(socket.addMessage(text));

      const idx = store.messages[channelName].findIndex((m) => m.id === tempId);
      if (idx !== -1) store.messages[channelName].splice(idx, 1);
    } catch (err) {
      console.error('Failed to send message via socket:', err);
      const idx = store.messages[channelName].findIndex((m) => m.id === tempId);
      if (idx !== -1) store.messages[channelName].splice(idx, 1);
      throw err;
    }
  } catch (err) {
    console.error('Send error:', err);
    systemMessage.value = 'Failed to send message';
  } finally {
    newMessage.value = '';

    // Po odoslani spravy posli, ze si prestal pisat
    if (isCurrentlyTyping) {
      isCurrentlyTyping = false;
      emitTyping({ typing: false });
    }
  }
};

//typing - teraz dajme bez timera, proste ked si v command line tak pises
let isCurrentlyTyping = false;
const typingUsers = ref<
  Record<
    string,
    {
      nickname: string;
      text: string;
    }
  >
>({});
const showTypingUsersDialog = ref(false);

const typingMembers = computed(() => {
  return Object.keys(typingUsers.value)
    .map((nickname) => {
      const member = channelMembers.value.find((m) => m.name === nickname);
      if (!member) return null;

      return {
        ...member, // obsahuje id, status, name, avatar
        typingText: typingUsers.value[nickname].text,
      };
    })
    .filter((m): m is (typeof channelMembers.value)[number] & { typingText: string } => m !== null);
});

const typingAvatars = computed(() => {
  return typingMembers.value.slice(0, 3).map((member) => ({
    //maximalne 3 avatari sa ukazu
    nickname: member.name,
    avatar: member.avatar || '',
  }));
});

const selectedTypingMember = ref<null | (typeof typingMembers.value)[number]>(null);

const hasTypingUsers = computed(() => typingMembers.value.length > 0);

const handleTypingStart = () => {
  if (!activeChannel.value || isOffline.value) return;
  if (isCurrentlyTyping) return;

  isCurrentlyTyping = true;
  emitTyping({ typing: true, text: newMessage.value });
};

const handleTyping = () => {
  if (!activeChannel.value || isOffline.value) return;

  if (!isCurrentlyTyping) {
    isCurrentlyTyping = true;
  }

  // send typing s aktualnym textom
  if (activeChannel.value) {
    const socket = channelService.in(activeChannel.value.name);
    if (socket && socket.socket.connected) {
      // user is typing
      socket.sendTyping({
        typing: true,
        text: newMessage.value,
      });
    }
  }
};

const handleTypingStop = () => {
  // Ak strati focus napriklad klikne prec, stopujeme typing
  if (isCurrentlyTyping) {
    isCurrentlyTyping = false;
    if (activeChannel.value) {
      const socket = channelService.in(activeChannel.value.name);
      if (socket && socket.socket.connected) {
        // user is typing
        socket.sendTyping({
          typing: false,
        });
      }
    }
  }
};
interface TypingPayload {
  typing: boolean;
  text?: string;
}

const emitTyping = (payload: TypingPayload) => {
  if (!activeChannel.value) return;

  const socket = channelService.in(activeChannel.value.name);
  if (!socket || !socket.socket.connected) return;

  void socket.sendTyping(payload);
};

const handleUserTyping = (payload: { nickname: string; typing: boolean; text?: string }) => {
  if (payload.typing) {
    typingUsers.value = {
      ...typingUsers.value, // aby nam vue zareagovalo
      [payload.nickname]: {
        nickname: payload.nickname,
        text: payload.text || '',
      },
    };
  } else {
    const copy = { ...typingUsers.value };
    delete copy[payload.nickname];
    typingUsers.value = copy;
  }
};

watch(activeChannel, (newChannel, oldChannel) => {
  // odpoj stary listener
  if (oldChannel) {
    const oldSocket = channelService.in(oldChannel.name);
    if (oldSocket) {
      oldSocket.socket.off('user:typing', handleUserTyping);
    }
    // vycisti typing pre stary kanal
    typingUsers.value = {};
  }

  // pripoj novy
  if (newChannel) {
    const socket = channelService.in(newChannel.name);
    if (socket) {
      console.log('Registering typing listener for channel:', newChannel.name);
      socket.socket.on('user:typing', handleUserTyping);
    }
  }
});

onUnmounted(() => {
  if (isCurrentlyTyping && activeChannel.value) {
    emitTyping({ typing: false });
  }
  if (activeChannel.value) {
    const socket = channelService.in(activeChannel.value.name);
    if (socket) {
      socket.socket.off('user:typing', handleUserTyping);
    }
  }
});
</script>

<style scoped>
.my-message {
  background: #ffd700 !important;
  color: black;
  max-width: 70%;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.other-message {
  background: #f5f5f5;
  color: black;
  max-width: 70%;
}

.q-pa-sm.rounded-borders {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.scroll {
  overflow-y: auto;
  height: 100%;
}
.relative-position {
  position: relative;
}
.command-input {
  font-family: monospace;
  max-height: 150px;
  overflow-y: auto;
}
.mention-highlight {
  background: #fff8c4 !important;
  border-left: 4px solid #f59e0b !important;
  font-weight: 600;
}

.mention-pulse {
  animation: mentionPulse 2s infinite;
}
@keyframes mentionPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
  }
}
.transition-all {
  transition: all 0.3s ease;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  position: absolute;
  bottom: 2px;
  right: 2px;
  z-index: 1;
}
.status-online {
  background-color: #4caf50;
}
.status-dnd {
  background-color: #f44336;
}
.status-offline {
  background-color: #9e9e9e;
}
.friends-list-content {
  z-index: 1;
}
.typing-avatars {
  display: flex;
  align-items: center;
}

.typing-avatar {
  border-radius: 50%;
  margin-left: -12px;
  box-shadow:
    0 0 0 2px white,
    0 2px 6px rgba(0, 0, 0, 0.15);
  background-color: white;
}

.typing-avatar:first-child {
  margin-left: 0;
}

.typing-dots {
  display: flex;
  align-items: center;
  height: 32px;
}

.typing-dots span {
  width: 5px;
  height: 5px;
  margin: 0 2px;
  background-color: #9e9e9e;
  border-radius: 50%;
  animation: typingBounce 1.4s infinite both;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}
.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typingBounce {
  0% {
    transform: translateY(0);
    opacity: 0.4;
  }
  20% {
    transform: translateY(-4px);
    opacity: 1;
  }
  40% {
    transform: translateY(0);
    opacity: 0.4;
  }
}
.dnd-emoji {
  position: absolute;
  top: -10px;
  right: -7px;
  font-size: 16px;
}
</style>
