import { boot } from "quasar/wrappers";
import type { Manager } from "socket.io-client";
import { SocketManager, type BootParams } from "src/services/SocketManager";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $io: Manager;
  }
}

// create socket.io manager
const io = SocketManager.createManager(process.env.API_URL);

export default boot((params: BootParams) => {
  // pridat do globalProperties
  params.app.config.globalProperties.$io = io;

  // boot socket manager (subscribe vsetky namespace)
  SocketManager.boot(params);
});

export { io };
