import { utils } from "sc-common";

export default class AdminAuthenticationConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient, storage, token, secretKey) {
        if (utils.authentication.adminAuthenticate(token, secretKey)) {
            storage.loggedAdmins[socketClient.id] = { socketClient };
            socketClient.emit("message", { authorized: true });
        } else {
            socketClient.emit("message", { unauth: { message: "Authentication failure" } });
        }
    }
}
