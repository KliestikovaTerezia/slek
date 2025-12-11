// src/types/Notification.ts
export interface Notification {
  id: number;
  userId: number;
  message: string;
  createdAt: string; // alebo Date, podľa toho čo vraciaš
}
