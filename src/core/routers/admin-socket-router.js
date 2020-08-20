import { logger } from "sc-common";
import { AdminAuthenticationConsumer } from "./../event-consumers";

export default class BaseAdminSocketRouter {
    /**
     * @param {AdminAuthenticationConsumer} adminAuthenticationConsumer
     */
    constructor(adminAuthenticationConsumer = null) {
        this.adminAuthenticationConsumer = adminAuthenticationConsumer ?? new AdminAuthenticationConsumer();
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(storage, socketClient, adminSecretKey) {
        this.storage = storage;
        this.socketClient = socketClient;
        this.adminSecretKey = adminSecretKey;
        this.socketClient.on("message", this.handleMessage.bind(this));
    }

    async handleMessage(payload) {
        try {
            if (payload.authentication) {
                this.adminAuthenticationConsumer.consume(this.socketClient, this.storage, payload.authentication.jwt, this.adminSecretKey);
            }
        } catch (err) {
            logger.log(err);
        }
    }
}
