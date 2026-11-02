import type { BootCallback } from '@quasar/app-webpack';
import { Manager } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { authManager } from '.';

export type BootParams = Parameters<BootCallback>[0];

export interface SocketManagerContract {
  namespace: string;
  readonly socket: Socket;
  subscribe(params: BootParams): void;
  destroy(): void;
}

export interface SocketManagerConstructorContract {
  new (namespace: string): SocketManagerContract;
  getManager(): Manager;
  createManager(uri: string): Manager;
  addInstance(instance: SocketManagerContract): void;
  destroyInstance(instance: SocketManagerContract): void;
}

const DEBUG = process.env.NODE_ENV === 'development';

export abstract class SocketManager implements SocketManagerContract {
  private static manager: Manager | null = null;
  private static instances: SocketManagerContract[] = [];
  private static namespaces: Set<string> = new Set();
  private static params: BootParams | null = null;
  private static activeInstances: SocketManagerContract[] = [];
  private static managerUri: string | undefined = undefined;

  public static getManager(): Manager {
    if (!this.manager) {
      // ak je null po offline rezime
      if (!this.managerUri) {
        throw new Error('Socket.io Manager URI not set. Call createManager(uri) first.');
      }
      // automaticky ho znova vytvorime
      console.warn('[SocketManager] Manager bol zničený, automaticky ho znova vytvárame.');
      // ulozime to this.manager
      return this.createManager(this.managerUri);
    }
    // ak uz existuje, vrat ho
    return this.manager;
  }

  public static createManager(uri?: string): Manager {
    this.managerUri = uri;
    const manager = new Manager(uri, { autoConnect: false });
    this.manager = manager;
    return manager;
  }

  public static addInstance(instance: SocketManagerContract): void {
    if (this.namespaces.has(instance.namespace)) {
      throw new Error(`Duplicate socket manager created for namespace "${instance.namespace}".`);
    }

    this.namespaces.add(instance.namespace);
    this.activeInstances.push(instance);

    // ak bol socket manager uz bootnuty, hned spustime subscribe a connect
    if (this.params !== null) {
      this.bootInstance(instance);
    }
  }

  public static destroyInstance(
    instance: SocketManagerContract & { $socket: Socket | null },
  ): void {
    this.instances = this.instances.filter((socket) => socket !== instance);
    this.namespaces.delete(instance.namespace);
    instance.socket.disconnect();
    instance.socket.removeAllListeners();
    instance.$socket = null;
  }

  private static bootInstance(instance: SocketManagerContract): void {
    instance.subscribe(this.params!);
    // connect socket
    instance.socket.connect();
  }

  public static boot(params: BootParams): void {
    if (this.params) {
      throw new Error('SocketManager is already booted. Call it once from quasar boot file.');
    }

    this.params = params;
    // zavolaj subscribe na vsetky instance a pripoj sockety
    this.instances.forEach((instance) => this.bootInstance(instance));
  }

  private $socket: Socket | null = null;

  public get socket(): Socket {
    if (!this.$socket) {
      this.$socket = this.socketWithAuth();
    }

    return this.$socket;
  }

  constructor(public namespace: string) {
    (this.constructor as SocketManagerConstructorContract).addInstance(this);
  }

  private socketWithAuth(): Socket {
    const io = (this.constructor as SocketManagerConstructorContract).getManager();

    const socket = io.socket(this.namespace, {
      auth: { token: authManager.getToken() },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('connect_error', (err: Error & { data?: any }) => {
      if (DEBUG) {
        console.error(`${this.namespace} [connect_error]`, err.message, err.data);
      }

      if (err.data?.status === 401) {
        const unsubscribe = authManager.onChange((token) => {
          socket.auth = { token };
          unsubscribe();
          socket.connect();
        });
      }
    });

    if (DEBUG) {
      socket.on('connect', () => {
        console.info(`${this.namespace} [connect]`);
      });

      socket.on('disconnect', (reason) => {
        console.info(`${this.namespace} [disconnect]`, reason);
      });

      socket.on('error', (err: Error) => {
        console.error(`${this.namespace} [error]`, err.message);
      });

      socket.onAny((event, ...args) => {
        console.info(`${this.namespace} [${event}]`, args);
      });
    }

    return socket;
  }

  //na emit server event a vrati promise vyriesenu s odpovedou servera
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected emitAsync<T>(event: string, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, ...args, (error: Error | null, response: T) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  public destroy(): void {
    (this.constructor as SocketManagerConstructorContract).destroyInstance(this);
  }

  public static disconnectManager(): void {
    if (this.manager) {
      console.log('[SocketManager] Disconnecting main Socket.IO Manager.');
      // odpojí vsetky pripojene sockety
      this.manager._close();
      // reset zoznam aktivnych instancii a namespacov
      this.activeInstances = [];
      this.namespaces.clear();

      this.manager = null;
    }
  }

  public abstract subscribe(params: BootParams): void;
}
