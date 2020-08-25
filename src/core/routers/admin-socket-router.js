import { logger } from "sc-common";

import { AdminAuthenticationConsumer, AdminMonitorConsumer } from "./../event-consumers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BaseAdminSocketRouter {
    /**
     * @param {AdminAuthenticationConsumer} adminAuthenticationConsumer
     * @param {AdminMonitorConsumer} adminMonitorConsumer
     */
    constructor(adminAuthenticationConsumer = null, adminMonitorConsumer = null) {
        this.adminAuthenticationConsumer = adminAuthenticationConsumer ?? new AdminAuthenticationConsumer();
        this.adminMonitorConsumer = adminMonitorConsumer ?? new AdminMonitorConsumer();
    }

    /**
     * @param {GameDefinition} definition
     * @param {GameData} definition
     * @param {SocketIO.Socket} socketClient
     * @param {string} adminSecretKey
     */
    init(definition, gameData, socketClient, adminSecretKey) {
        this.definition = definition;
        this.gameData = gameData;
        this.socketClient = socketClient;
        this.adminSecretKey = adminSecretKey;
        this.socketClient.on("message", this.handleMessage.bind(this));
    }

    async handleMessage(payload) {
        try {
            if (payload.authentication) {
                this.adminAuthenticationConsumer.consume(this.socketClient, this.gameData, payload.authentication.jwt, this.adminSecretKey);
            }

            if (payload[this.definition.name] && payload[this.definition.name].get_new) {
                this.adminMonitorConsumer.consume(this.socketClient, this.definition, this.gameData);
            }
        } catch (err) {
            logger.log(err);
        }
    }
}
