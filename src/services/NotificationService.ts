import { AppVisibility } from 'quasar';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: unknown;
}

class NotificationService {
  private permissionGranted = false;

  /**
   * Požiada o povolenie na zobrazovanie notifikácií
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
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

  /**
   * Zobrazí systémovú notifikáciu IBA ak je aplikácia NEVIDITEĽNÁ
   */
  showIfHidden(options: NotificationOptions): void {
    // Skontroluj, či je aplikácia viditeľná
    // if (AppVisibility.appVisible) {
    //   console.log('App is visible, skipping system notification');
    //   return;
    // }

    const isHidden =
      typeof AppVisibility.appVisible === 'boolean' ? !AppVisibility.appVisible : document.hidden;

    if (!isHidden) {
      console.log('App visible -> skip notif');
      return;
    }

    this.show(options);
  }

  /**
   * Zobrazí systémovú notifikáciu (vždy)
   */
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

    // Kliknutie na notifikáciu = focus na appku
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  /**
   * Skontroluje, či má používateľ povolené notifikácie
   */
  get hasPermission(): boolean {
    return this.permissionGranted || Notification.permission === 'granted';
  }
}

export default new NotificationService();
