import { logger } from "sc-common";
import { Socket } from "socket.io";

import { AdminAuthenticationConsumer, AdminDisconnectConsumer, AdminMonitorConsumer } from "./../event-consumers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import { createHashMD5, randomString } from "../helpers/crypto-helper";

export default class BaseAdminSocketRouter {
    /**
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {AdminAuthenticationConsumer} dependencies.adminAuthenticationConsumer
     * @param {AdminMonitorConsumer} dependencies.adminMonitorConsumer
     * @param {AdminDisconnectConsumer} dependencies.adminDisconnectConsumer
     * @param {logger} dependencies.logService
     * @param {Object} appConfigs
     */
    constructor({
        definition,
        gameData,
        adminAuthenticationConsumer,
        adminMonitorConsumer,
        adminDisconnectConsumer,
        logService,
        appConfigs,
        roundResultPublisher,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.adminAuthenticationConsumer = adminAuthenticationConsumer;
        this.adminMonitorConsumer = adminMonitorConsumer;
        this.adminDisconnectConsumer = adminDisconnectConsumer;
        this.logService = logService;
        this.appConfigs = appConfigs;
        this.roundResultPublisher = roundResultPublisher;
    }

    /**
     * @param {Socket} socketClient
     */
    init(socketClient) {
        this.socketClient = socketClient;
        this.socketClient.on("message", this.handleMessage.bind(this));
        this.socketClient.on("disconnect", this.handleDisconnect.bind(this));
    }

    async handleMessage(payload) {
        try {
            if (payload.authentication) {
                this.adminAuthenticationConsumer.consume(this.socketClient, payload.authentication.jwt);
            }

            if (payload[this.definition.name] && payload[this.definition.name].get_new && this.verify()) {
                await this.adminMonitorConsumer.consume(this.socketClient);
            }

            if (
                this.appConfigs.sentry.env !== "PROD" &&
                payload[this.definition.name] &&
                payload[this.definition.name].set_result &&
                this.verify()
            ) {
                const { set_result } = payload[this.definition.name];

                this.gameData.settlementResultFromAdmin = {
                    roundId: set_result.roundId,
                    result: set_result.result,
                };

                if (this.gameData.roundId === set_result.roundId) {
                    this.gameData.result = set_result.result;
                    const rawValue = `${this.definition.generateRawResultForMd5(this.gameData.result)}${randomString()}`;
                    this.gameData.md5 = { hashValue: createHashMD5(rawValue), rawValue };
                    this.roundResultPublisher.publishToAllUsers({ md5: { hashValue: this.gameData.md5.hashValue } });
                }
            }
        } catch (err) {
            this.logService.logError(err);
        }
    }

    handleDisconnect() {
        try {
            this.adminDisconnectConsumer.consume(this.socketClient);
        } catch (err) {
            this.logService.logError(err);
        }
    }

    verify() {
        if (this.gameData.admins[this.socketClient.id]) {
            return true;
        }

        this.socketClient.emit("message", { unauth: { message: "Unauthorized!" } });
        this.socketClient.disconnect(true);

        this.logService.logError("Admin not found in server storage");

        return false;
    }
}
