import { AppVisibility } from 'quasar';
import { useStatusStore } from 'src/stores/status';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: unknown;
}

class NotificationService {
  private permissionGranted = false;
  private statusStore = useStatusStore();

  //iOS Safari nema Notification API (iba v appke pridanej na plochu)
  get isSupported(): boolean {
    return 'Notification' in window;
  }

  //aktualny stav povolenia, 'denied' ak browser notifikacie nepodporuje
  get permission(): NotificationPermission {
    return this.isSupported ? Notification.permission : 'denied';
  }

  //poziada o povolenie na zobrazovanie notifikacii
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Browser nepodporuje notifikácie');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Používateľ zamietol notifikácie');
      return false;
    }

    const permission = await Notification.requestPermission();
    this.permissionGranted = permission === 'granted';
    return this.permissionGranted;
  }

  //zobrazi systemovu notifikaciu iba ak je aplikacia skryta
  showIfHidden(options: NotificationOptions): void {
    const isHidden =
      typeof AppVisibility.appVisible === 'boolean' ? !AppVisibility.appVisible : document.hidden;

    if (!isHidden || this.statusStore.isMyDndActive) {
      console.log(!isHidden ? 'App visible -> skip notif' : 'Dnd is active -> skip notif');
      return;
    }

    this.show(options);
  }

  //zobrazi systemovu notifikaciu vzdy
  show(options: NotificationOptions): void {
    if (!this.hasPermission) {
      console.warn('Notifications not allowed');
      return;
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/icons/favicon-128x128.png',
      tag: options.tag,
      data: options.data,
    });

    // klik na notifikaciu - focus na okno
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  //skontroluje ci ma povolenie na notifikacie
  get hasPermission(): boolean {
    return this.permissionGranted || this.permission === 'granted';
  }
}

export default new NotificationService();
