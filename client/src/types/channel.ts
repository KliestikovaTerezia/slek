export interface Channel {
  id: number;
  name: string;
  type: 'public' | 'private';
  messages?: { id: number; user: string; text: string }[];
  members?: Member[]; // ← Change from number[] to Member[]
  isAdmin?: boolean;
}

export interface Member {
  id: number;
  name: string;
  avatar: string;
  isAdmin: boolean;
}
