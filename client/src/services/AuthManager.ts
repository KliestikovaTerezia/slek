import { LocalStorage } from 'quasar';

type ChangeListener = (newToken: string | null, oldToken: string | null) => void; //dostane novy a stary token
//pouziva sa na reakiu na zmenu tokenu (login, logout)

// toto riesi tokeny - ulozenie do localstorage a notifikovanie o zmenach
class AuthManager {
  private currentToken: string | null = this.getToken(); //drzi aktualny token
  private onChangeListeners: ChangeListener[] = [];

  private storageListener = (evt: StorageEvent) => {
    //ak sa user odhlasi/prihlasi v inom okne, ostatne okna sa o tom dozvedia
    if (evt.key !== this.storageKey) {
      return;
    }

    this.notifyListeners();
  };

  constructor(private storageKey: string) {
    window.addEventListener('storage', this.storageListener); //registracia listenera
  }

  private notifyListeners(): void {
    const newToken = this.getToken();

    if (this.currentToken === newToken) {
      //ak sa token nezmenil, nic nerob
      return;
    }

    this.onChangeListeners.forEach((fn) => fn(newToken, this.currentToken)); //notifikuj vsetkych listenerov o zmene tokenu
    this.currentToken = newToken;
  }

  // listener na zmeny
  public onChange(listener: ChangeListener): () => void {
    //umoznuje inym castiam appky reaokciu na zmenu tokenu
    this.onChangeListeners.push(listener);

    // zavolaj listener s aktualnym tokenom ak ho mame
    if (this.currentToken !== null) {
      window.setTimeout(() => listener(this.currentToken, null), 0);
    }

    return () => {
      const idx = this.onChangeListeners.indexOf(listener);

      if (idx >= 0) {
        this.onChangeListeners.splice(idx, 1);
      }
    };
  }

  public onLogout(listener: () => void): () => void {
    return this.onChange((token) => {
      if (token === null) {
        listener();
      }
    });
  }

  public getToken(): string | null {
    return LocalStorage.getItem(this.storageKey);
  }

  public removeToken(): void {
    LocalStorage.remove(this.storageKey);
    this.notifyListeners();
  }

  //odstran token z localstorage
  public logout(): void {
    return this.removeToken();
  }

  public setToken(token: string): void {
    LocalStorage.set(this.storageKey, token);
    this.notifyListeners();
  }
}

export default new AuthManager('auth_token');
