import { utils } from "sc-common";

export default class AdminAuthenticationConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    consume(socketClient, storage, token, secretKey) {
        if (utils.authentication.adminAuthenticate(token, secretKey)) {
            const adminData = { socketClient };

            storage.loggedAdmins[socketClient.id] = { ...adminData };

            socketClient.emit("message", { authorized: true });
        } else {
            socketClient.emit("message", { unauth: { message: "Authentication failure" } });
        }
    }
}
