export type InvitationPayload = {
  id: number
  channelId: number
  channelName: string
  channelType: 'public' | 'private'
  from: string
  fromAvatar: string | null
  createdAt: import('luxon').DateTime
}