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
          @click="openInvitations"
        />
        <q-badge v-if="invitationCount > 0" color="red" floating transparent>
          {{ invitationCount }}
        </q-badge>
      </div>
    </div>

    <!-- Hlavna cast chatu -->
    <div class="column col bg-white">
      <div class="notification-positioner">
        <!-- <ChatNotification
          v-if="showChatNotification"
          :sender-name="notificationData.senderName"
          :sender-avatar="notificationData.senderAvatar"
          :message="notificationData.message"
          :duration="4000"
          @close="handleNotificationClose"
        /> -->
      </div>
      <!-- hlavna chatova cast -->
      <div class="row col">
        <!-- pouzijeme nas komponenet ChannelListSide -->
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
                        @click="showAddPeopleDialog = true"
                      >
                        <q-item-section>Invite people</q-item-section>
                      </q-item>
                      <q-item
                        v-if="canRemovePeople"
                        clickable
                        v-close-popup
                        @click="showRemovePeopleDialog = true"
                      >
                        <q-item-section>Remove people</q-item-section>
                      </q-item>
                      <q-item
                        v-if="canKickPeople"
                        clickable
                        v-close-popup
                        @click="showKickPeopleDialog = true"
                      >
                        <q-item-section>Kick people</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="leaveChannel">
                        <q-item-section>Leave channel</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="showMembersDialog = true">
                        <q-item-section>Members</q-item-section>
                      </q-item>
                      <q-item
                        clickable
                        v-close-popup
                        v-if="activeChannel?.isAdmin"
                        @click="deleteChannel"
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
                <div v-for="msg in visibleMessages" :key="msg.id" class="q-mb-sm">
                  <!-- nasa sprava je napravo a zlta -->
                  <div v-if="isMyMessage(msg)" class="row justify-end">
                    <div class="my-message q-pa-sm rounded-borders">
                      {{ msg.text }}
                    </div>
                  </div>

                  <!-- CUDZIA SPRÁVA → NA ĽAVO -->
                  <div v-else class="row justify-start items-end q-gutter-sm">
                    <div class="relative-position">
                      <ProfilePicture
                        :avatar="getUserByName(msg.user).avatar"
                        size="40px"
                        bgColor="grey-3"
                        class="q-mr-sm"
                      />
                      <div
                        class="status-indicator q-ml-sm"
                        :class="`status-${getUserByName(msg.user).status}`"
                      ></div>
                    </div>
                    <div class="column items-start">
                      <div class="text-caption text-grey-6 q-mb-xs">
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

                <!-- Milan nam pise -->
                <div
                  v-if="activeChannel?.name === 'UniLife'"
                  class="typing-message row justify-start items-end q-gutter-sm text-grey-7"
                >
                  <ProfilePicture
                    :avatar="getUserByName('Milan').avatar"
                    size="40px"
                    bgColor="grey-3"
                  />
                  <div class="column items-start">
                    <!-- meno nad správou -->
                    <div class="message-username text-caption text-grey-6 q-mb-xs">
                      Milan is typing ...
                    </div>

                    <!-- text správy -->
                    <div class="bg-grey-2 q-pa-sm rounded-borders">
                      Caute prosim kde najdem github r|
                    </div>
                  </div>
                </div>
              </q-infinite-scroll>
            </q-scroll-area>
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
                class="col"
                @keyup.enter="sendMessage"
              />
              <q-btn color="primary" label="Send" class="q-ml-sm" @click="sendMessage" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- dialogy -->
    <!-- <q-dialog v-model="showAddFriendDialog">
      <q-card style="min-width: 300px;">
        <q-card-section>
          <div class="text-h6">Add new friend</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newFriendName"
            label="Friend name"
            outlined
            dense
            autofocus
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Add" color="primary" @click="addFriend" />
        </q-card-actions>
      </q-card>
    </q-dialog> -->

    <q-dialog v-model="showInvitationsDialog">
      <q-card style="min-width: 350px">
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
              @new-value="validateNickname"
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
      <q-card style="min-width: 400px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Invite people to {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="selectedNicknames"
            multiple
            :options="users.map((f) => ({ label: f.name, value: f.id }))"
            label="Select friends to add"
            outlined
            dense
            use-chips
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Add" color="primary" @click="addPeopleToChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showRemovePeopleDialog">
      <q-card style="min-width: 400px">
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
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Remove" color="primary" @click="removePeopleFromChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog pre nastavenie statusu usera -->
    <!-- <q-dialog v-model="showStatusDialog">
      <q-card style="min-width: 300px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Set your status</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="userStatus"
            :options="statusOptions"
            option-value="value"
            option-label="label"
            label="Status"
            outlined
            dense
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Save" color="primary" @click="saveUserStatus" />
        </q-card-actions>
      </q-card>
    </q-dialog> -->

    <!-- Dialog pre zoznam členov kanála -->
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
                    <div class="status-indicator q-ml-sm" :class="`status-${member.status}`"></div>
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
          <q-btn color="primary" label="Delete" @click="confirmDeleteChannel" />
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
      <q-card style="min-width: 400px">
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
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import ProfilePicture from '../components/ProfilePicture.vue';
// import ChatNotification from '../components/ChatNotification.vue';
import ChannelListSide from '../components/ChannelListSide.vue';
import type { QScrollArea } from 'quasar';
import type { Channel } from 'src/types/channel';
import channelService from 'src/services/ChannelService';
import { useInvitationsStore } from 'src/stores/invitations';
import type { Invitation } from 'src/types/invitation';

// backend
import { api } from 'src/boot/axios';
import { useChannelsStore } from 'src/stores/channels';

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

const channelMembers = computed(() => {
  return channelsStore.activeChannelMembers.map((m) => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    status: 'online' as UserStatus, // TODO: Add real status
  }));
});

// Quasar breakpoint
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

// Status options
// const statusOptions = [
//   { label: 'Online', value: 'online' as const },
//   { label: 'Do Not Disturb', value: 'dnd' as const },
//   { label: 'Offline', value: 'offline' as const },
// ];

// Aktuálny stav používateľa
// const userStatus = ref<UserStatus>('online');

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
      avatar: 'https://cdn.quasar.dev/img/avatar.png',
      status: 'offline' as const,
    }
  );
};

const newChannelType = ref<'public' | 'private'>('public');

// const invitations = ref<Invitation[]>([{ id: 1, from: 'Tomas', channel: 'Developers' }]);

// const invitationCount = computed(() => invitations.value.length);

const channelsStore = useChannelsStore();
const currentMessages = computed(() => {
  if (!activeChannel.value) return [];
  return channelsStore.messages[activeChannel.value.name] || [];
});

// const showAddFriendDialog = ref(false);
const showInvitationsDialog = ref(false);
const showCreateChannelDialog = ref(false);
const showAddPeopleDialog = ref(false);
const showRemovePeopleDialog = ref(false);
// const showStatusDialog = ref(false);
const showMembersDialog = ref(false);
// const newFriendName = ref('');
const newChannelName = ref('');
const selectedNicknames = ref<string[]>([]);

const validateNickname = (
  val: string,
  done: (item?: string, mode?: 'toggle' | 'add' | 'add-unique') => void,
) => {
  // Just add the nickname - we'll validate on backend
  if (val.length > 0) {
    done(val, 'add-unique');
  }
};

// const dummyMessages = Array.from({ length: 40 }, (_, i) => ({
//   id: i + 1,
//   user: i % 2 === 0 ? 'You' : 'Maggie',
//   text: i % 2 === 0 ? `Tvoja správa ${i + 1}` : `Maggie odpoveď ${i + 1}`,
// }));

// const dummy_chat = channels.value.find((f) => f.name === 'General');
// if (dummy_chat) dummy_chat.messages = dummyMessages;

// Definícia channelMembers
// const channelMembers = computed(() => {
//   if (!activeChannel.value?.members) return [];
//   return users.value.filter(f => activeChannel.value!.members!.includes(f.id));
// });

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

// const loadMoreMessages = async () => {
//   if (isLoadingMore.value) return;
//   if (loadedMessagesCount.value >= (currentMessages.value?.length || 0)) return; //uz je nacitane vsetko

//   isLoadingMore.value = true;
//   await new Promise(resolve => setTimeout(resolve, 1000)); //simulujeme nacitavanie
//   loadedMessagesCount.value += 10; //nacita nam dalsich 10
//   isLoadingMore.value = false;
// };

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
  await new Promise((resolve) => setTimeout(resolve, 1200)); // simulácia načítania
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

  if (socket.isJoined) {
    if (!channelsStore.messages[ch.name]?.length) {
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
    await socket.joinChannel(); // ← tu sa pripojíš len raz!
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

  // Public channels: anyone can invite
  if (activeChannel.value.type === 'public') return true;

  // Private channels: only admin can invite
  return activeChannel.value.isAdmin;
});

const canRemovePeople = computed(() => {
  if (!activeChannel.value) return false;

  // Public channels: anyone can remove? Or only admin? (decide your rule)
  // For now, let's say only admin can remove from any channel
  return activeChannel.value.isAdmin;
});

const canKickPeople = computed(() => {
  if (!activeChannel.value) return false;

  // Only in public channels AND you're not admin
  return activeChannel.value.type === 'public' && !activeChannel.value.isAdmin;
});

const showKickPeopleDialog = ref(false);

const kickPeopleFromChannel = () => {
  if (!activeChannel.value) return;
  // TODO: Implement kick voting logic
  systemMessage.value = 'Kick voting will be implemented with /kick command';
  showKickPeopleDialog.value = false;
  selectedNicknames.value = [];
};

const invitationsStore = useInvitationsStore();
const invitationCount = computed(() => invitationsStore.count);
const invitations = computed(() => invitationsStore.list);

const openInvitations = () => {
  showInvitationsDialog.value = true;
};

const acceptInvite = async (invitation: Invitation) => {
  await invitationsStore.accept(invitation);
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

  // Clear previous errors
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
        return; // Stop here, don't create channel
      }
    } catch (err) {
      console.error('Failed to validate nicknames:', err);
      invalidNicknamesError.value = 'Failed to validate nicknames';
      return;
    }
  }

  // NOW CREATE THE CHANNEL (only if nicknames are valid)
  try {
    const response = await api.post('/api/channels', {
      name,
      type: newChannelType.value,
      nicknames: selectedNicknames.value,
    });

    channelsStore.channelsList.unshift(response.data);
    channelsStore.setActive(response.data.name);

    // Join via WebSocket
    const socket = channelService.join(response.data.name);

    if (!socket.socket.connected) {
      await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
    }

    try {
      await socket.joinChannel();
      systemMessage.value = `Created channel ${response.data.name}`;
      //and here will be a for loop that will send invites to all nicknames in selected nicknames
      for (const nickname of selectedNicknames.value) {
        try {
          await socket.inviteUsers([nickname]);
        } catch (err) {
          console.error(`Failed to invite ${nickname}`, err);
        }
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

    // Reset form
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

  // Store the channel and show confirmation
  channelToLeave.value = activeChannel.value;
  showLeaveConfirm.value = true;
};

// const confirmLeaveChannel = async () => {
//   if (!channelToLeave.value) return;

//   const channelName = channelToLeave.value.name;
//   // const channelId = channelToLeave.value.id;
//   const memberCount = channelToLeave.value.members?.length || 0;

//   try {
//     // NAJPRV WebSocket leave (aby backend emitol member:left)
//     const socket = channelService.in(channelName);
//     if (socket) {
//       await socket.leaveChannel(); // ← volá backend leaveChannel cez WS
//     }

//     // POTOM HTTP leave (pre istotu, ak WS zlyhá)
//     // await api.post(`/api/channels/${channelId}/leave`);

//     // ✅ Refresh channel list (natiahne aktuálne dáta z backendu)
//     await channelsStore.fetchChannels();

//     // Clear active channel
//     channelsStore.setActive(channelsStore.channelsList[0]?.name || '');

//     // Check if user was the last member
//     if (memberCount <= 1) {
//       systemMessage.value = `You were the last member. Channel "${channelName}" has been deleted.`;
//     } else {
//       systemMessage.value = `Left channel "${channelName}"`;
//     }
//   } catch (error) {
//     console.error('Failed to leave channel:', error);
//     systemMessage.value = 'Failed to leave channel';
//   } finally {
//     showLeaveConfirm.value = false;
//     channelToLeave.value = null;
//   }
// };

const confirmLeaveChannel = async () => {
  if (!channelToLeave.value) return;

  const channelName = channelToLeave.value.name;
  const socket = channelService.in(channelName);

  try {
    // VŽDY choď cez WebSocket – aj v private!
    if (socket && socket.isJoined) {
      await socket.leaveChannel(); // ← toto je kľúčové
    } else {
      // Ak z nejakého dôvodu nie je pripojený – pripoj sa a odíď
      const tempSocket = channelService.join(channelName);
      if (!tempSocket.socket.connected) {
        await new Promise<void>((resolve) => tempSocket.socket.once('connect', resolve));
      }
      await tempSocket.joinChannel();
      await tempSocket.leaveChannel();
    }

    // HTTP leave už nepotrebuješ vôbec (ani pre posledného člena)
    // Backend to vyrieši v leaveChannel() – ak je posledný → zmaže kanál

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
    // Dialog sa automaticky updatuje vďaka computed channelMembers
  },
  { deep: true },
);

//deleting a channel
const showDeleteConfirm = ref(false);
const channelToDelete = ref<Channel | null>(null);

const deleteChannel = () => {
  if (!activeChannel.value) return;

  // Store the channel and show confirmation
  channelToDelete.value = activeChannel.value;
  showDeleteConfirm.value = true;
};

const confirmDeleteChannel = async () => {
  if (!channelToDelete.value) return;

  const channelName = channelToDelete.value.name;
  const channelId = channelToDelete.value.id;

  try {
    // Call backend to delete channel
    await api.delete(`/api/channels/${channelId}`);

    // Remove from local store
    const index = channelsStore.channelsList.findIndex((c) => c.id === channelId);
    if (index !== -1) {
      channelsStore.channelsList.splice(index, 1);
    }

    // Clear active channel
    channelsStore.setActive(channelsStore.channelsList[0]?.name || '');

    // Leave WebSocket room
    const socket = channelService.in(channelName);
    if (socket) {
      socket.socket.disconnect();
    }
  } catch (error) {
    console.error('Failed to delete channel:', error);
    systemMessage.value = 'Failed to delete channel';
  } finally {
    showDeleteConfirm.value = false;
    channelToDelete.value = null;
  }
};

const getChannelMembers = () => {
  return channelMembers.value.map((m) => ({
    label: m.name,
    value: m.id,
  }));
};

const addPeopleToChannel = () => {
  if (!activeChannel.value) return;
  // TODO: Call backend API to add people
  // await api.post(`/api/channels/${activeChannel.value.id}/members`, { userIds: selectedFriends.value })
  showAddPeopleDialog.value = false;
  selectedNicknames.value = [];
};

const removePeopleFromChannel = () => {
  if (!activeChannel.value) return;
  // TODO: Call backend API to remove people
  // await api.delete(`/api/channels/${activeChannel.value.id}/members`, { data: { userIds: selectedFriends.value }})
  showRemovePeopleDialog.value = false;
  selectedNicknames.value = [];
};

// to bude funkcia ktorou ulozime status usera na server- momentalne len zavrieme dialog
// const saveUserStatus = () => {
//   showStatusDialog.value = false;
// };

// CLI fixne
const newMessage = ref('');
const systemMessage = ref('');

// notifikacia data
// interface NotificationData {
//   senderName: string;
//   senderAvatar: string;
//   message: string;
// }

// const showChatNotification = ref(false);
// const notificationData = ref<NotificationData>({
//   senderName: 'Katka',
//   senderAvatar: 'https://cdn.quasar.dev/img/avatar2.jpg',
//   message: 'Ahoj pocuj ako mam spravit toto??',
// });

// const triggerChatNotification = () => {
//   showChatNotification.value = true;
// };

// const handleNotificationClose = () => {
//   showChatNotification.value = false;
// };

// spustame fixne notifikaciu pri kazdom reloadnuti stranky
// onMounted(async () => {

//   await invitationsStore.loadInitial();

//   // Počúvaj nové pozvánky v reálnom čase
//   window.addEventListener('invitation:received', ((e: CustomEvent<Invitation>) => {
//     invitationsStore.add(e.detail);
//   }) as EventListener);

//   window.addEventListener('user:removed', ((e: CustomEvent) => {
//     const { channelName, removedBy } = e.detail;
//     systemMessage.value = `You were removed from ${channelName} by ${removedBy}`;

//     // Refresh channels
//     channelsStore.fetchChannels();
//   }) as EventListener);

//   window.addEventListener('unhandledrejection', (event) => {
//     console.error('🔴🔴🔴 UNHANDLED REJECTION 🔴🔴🔴');
//     console.error('Reason:', event.reason);
//     console.error('Stack:', event.reason?.stack);
//     console.error('Promise:', event.promise);
//   });

//   try {
//     await authStore.check();
//     await fetchUsers();
//     await channelsStore.fetchChannels();

//     // Ak máš uložený posledný kanál (napr. v localStorage), obnov ho
//     const lastChannelName = localStorage.getItem('lastActiveChannel');
//     console.log('Last active channel from storage:', lastChannelName);
//     const lastChannelExists =
//       lastChannelName && channelsStore.channelsList.some((ch) => ch.name === lastChannelName);

//     if (lastChannelExists) {
//       channelsStore.setActive(lastChannelName); // ← toto je kľúčové!
//     } else if (channelsStore.channelsList.length > 0) {
//       // Ak nemá uložený, alebo bol zmazaný → choď na prvý
//       channelsStore.setActive(channelsStore.channelsList[0].name);
//     }

//     // znova sa pripoj do kanala, toto uz nahra aj spravy:
//     await channelsStore.rejoinActiveChannel();
//   } catch (err) {
//     console.error('Init failed:', err);
//   }

//   triggerChatNotification();
// });

onMounted(async () => {
  // setGlobalStores(channelsStore);

  // ✅ Register stores globally for socket access
  await invitationsStore.loadInitial();

  // Počúvaj nové pozvánky v reálnom čase
  window.addEventListener('invitation:received', ((e: CustomEvent<Invitation>) => {
    invitationsStore.add(e.detail);
  }) as EventListener);

  window.addEventListener('user:removed', ((e: CustomEvent) => {
    const { channelName, removedBy } = e.detail;
    systemMessage.value = `You were removed from ${channelName} by ${removedBy}`;

    // ✅ Refresh channels - AWAIT or use void
    void channelsStore.fetchChannels();
  }) as EventListener);

  try {
    await authStore.check();
    await fetchUsers();
    await channelsStore.fetchChannels();

    // Ak máš uložený posledný kanál (napr. v localStorage), obnov ho
    const lastChannelName = localStorage.getItem('lastActiveChannel');
    console.log('Last active channel from storage:', lastChannelName);
    const lastChannelExists =
      lastChannelName && channelsStore.channelsList.some((ch) => ch.name === lastChannelName);

    if (lastChannelExists) {
      channelsStore.setActive(lastChannelName);
    } else if (channelsStore.channelsList.length > 0) {
      channelsStore.setActive(channelsStore.channelsList[0].name);
    }

    // znova sa pripoj do kanala, toto uz nahra aj spravy:
    await channelsStore.rejoinActiveChannel();
  } catch (err) {
    console.error('Init failed:', err);
  }

  // triggerChatNotification();
});

// Po zmene kanála
watch(
  activeChannel,
  async (newChannel) => {
    if (!newChannel) return;

    // Ulož posledný kanál
    localStorage.setItem('lastActiveChannel', newChannel.name);

    // Reset scroll a načítanie správ TOTO NEFUNGUJE
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
    selectedNicknames.value = []; // ← Reset nicknames
    newChannelType.value = 'public';
    invalidNicknamesError.value = '';
  }
});

watch(selectedNicknames, () => {
  invalidNicknamesError.value = '';
});
// aby sa nam input na pridanie friend resetoval po kliknuti na cencel alebo mimo dialogu
// watch(showAddFriendDialog,(newVal) => {
//   if (!newVal) {
//     newFriendName.value = ''
//   }}
// )

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

      // 1. /join → allowed even when no channel exists
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
          // channel exists and is private
          if (existingChannel.type === 'private') {
            systemMessage.value = `"${existingChannel.name}" is a private channel. Only admins can invite you.`;
            newMessage.value = '';
            return;
          }

          //check if user is banned from channel
          try {
            const manager = channelService.join('General'); // Global manažér
            const banStatus = await manager.checkBanStatus(inputName);

            if (banStatus.status === 'banned') {
              systemMessage.value =
                banStatus.message || `You are banned from channel "${inputName}".`;
              newMessage.value = '';
              return; //Ban existuje, return!
            }
          } catch (error) {
            // Ak zlyhá Socket, nemali by sme povoliť join
            console.error('Failed to check ban status:', error);
            systemMessage.value = 'Failed to check channel status due to connectivity error.';
            newMessage.value = '';
            return;
          }

          // channel exists and is public - join it
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

        // channel doesn't exist - create it
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

        // If admin, delete the channel (channel will be destroyed for everyone)
        if (activeChannel.value.isAdmin) {
          channelToDelete.value = activeChannel.value;
          await confirmDeleteChannel();
          systemMessage.value = `Channel "${activeChannel.value.name}" has been closed by admin`;
        } else {
          // Regular member - just leave
          channelToLeave.value = activeChannel.value;
          await confirmLeaveChannel();
        }

        // Refresh channel list aby sa zobrazil update
        // await channelsStore.fetchChannels();

        return;
      } else if (command === 'quit') {
        if (!activeChannel.value) {
          systemMessage.value = 'No active channel';
          newMessage.value = '';
          return;
        }

        if (activeChannel.value.isAdmin) {
          channelToDelete.value = activeChannel.value;
          await confirmDeleteChannel();
          systemMessage.value = `Channel "${activeChannel.value.name}" has been discarded by admin`;
        } else {
          systemMessage.value = 'Only admin can close the channel';
        }
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

          // If user was banned, refresh channel members
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

      // ==================== /revoke command ====================
      if (command === 'revoke') {
        if (!activeChannel.value) {
          systemMessage.value = 'Please select a channel first';
          newMessage.value = '';
          return;
        }

        // Check if admin (for private channels)
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
    // First: if user has never joined any channel at all
    if (channelsStore.channelsList.length === 0) {
      systemMessage.value = 'You need to join or create a channel first. Try: /join General';
      newMessage.value = '';
      return;
    }

    // Second: if user has channels but none selected
    if (!activeChannel.value) {
      systemMessage.value = 'Please select a channel first (or type /join <name>)';
      newMessage.value = '';
      return;
    }

    // At this point we KNOW we have an active channel → safe to use
    const channelName = activeChannel.value.name;
    const socket = channelService.in(channelName) ?? channelService.join(channelName);

    const tempId = Date.now();
    const store = useChannelsStore();

    // Optimistic UI
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

    try {
      await Promise.resolve(socket.addMessage(text));

      // Remove temp message (server will push the real one)
      const idx = store.messages[channelName].findIndex((m) => m.id === tempId);
      if (idx !== -1) store.messages[channelName].splice(idx, 1);
    } catch (err) {
      console.error('Failed to send message via socket:', err);
      // Rollback optimistic message
      const idx = store.messages[channelName].findIndex((m) => m.id === tempId);
      if (idx !== -1) store.messages[channelName].splice(idx, 1);
      throw err;
    }
  } catch (err) {
    console.error('Send error:', err);
    systemMessage.value = 'Failed to send message';
  } finally {
    newMessage.value = '';
  }
};
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
  max-width: 700px;
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
  background: #fff8c4 !important; /* jemne žltá */
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
.notification-wrapper {
  position: relative;
  min-height: 80px;
}
.notification-positioner {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
}
.friends-list-content {
  z-index: 1;
}
.typing-message {
  position: absolute;
  bottom: 10px;
  left: 12px;
  display: flex;
}
.typing-text {
  color: #666;
}
</style>
