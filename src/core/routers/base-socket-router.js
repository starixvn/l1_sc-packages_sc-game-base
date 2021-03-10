import { logger } from "sc-common";

import { InGameConsumer, PlaceBetConsumer, UserDisconnectConsumer, UserSignInConsumer } from "./../event-consumers";
import { UserSignInPublisher } from "./../event-publishers";
import { HistoryQuery } from "./../query-apis";

export default class BaseSocketRouter {
    /**
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {UserSignInConsumer} dependencies.userSignInConsumer
     * @param {InGameConsumer} dependencies.inGameConsumer
     * @param {PlaceBetConsumer} dependencies.placeBetConsumer
     * @param {UserDisconnectConsumer} dependencies.userDisconnectConsumer
     * @param {UserSignInPublisher} dependencies.userSignInPublisher
     * @param {HistoryQuery} dependencies.historyQuery
     * @param {logger} ldependencies.logService
     */
    constructor({
        definition,
        gameData,
        userSignInConsumer,
        inGameConsumer,
        placeBetConsumer,
        userDisconnectConsumer,
        userSignInPublisher,
        historyQuery,
        logService,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInConsumer = userSignInConsumer;
        this.inGameConsumer = inGameConsumer;
        this.placeBetConsumer = placeBetConsumer;
        this.userDisconnectConsumer = userDisconnectConsumer;
        this.userSignInPublisher = userSignInPublisher;
        this.historyQuery = historyQuery;
        this.logService = logService;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(socketClient) {
        this.socketClient = socketClient;
        this.socketClient.on("bet", this.handlePlaceBet.bind(this));
        this.socketClient.on("signin", this.handleSignIn.bind(this));
        this.socketClient.on("inGame", this.handleInGame.bind(this));
        this.socketClient.on("getHistory", this.handleGetHistory.bind(this));
        this.socketClient.on("disconnect", this.handleDisconnect.bind(this));
    }

    handlePlaceBet(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            this.placeBetConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleSignIn(payload) {
        try {
            await this.userSignInConsumer.consume(this.socketClient, payload);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleInGame() {
        try {
            if (!this.verify()) {
                return;
            }

            await this.inGameConsumer.consume(this.gameData.realPlayers[this.socketClient.id]);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleGetHistory(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            const history = await this.historyQuery.queryHistory(
                this.gameData.realPlayers[this.socketClient.id],
                payload.page,
                this.definition.historyPageSize
            );

            this.socketClient.emit(this.definition.name, history);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    handleDisconnect() {
        try {
            this.userDisconnectConsumer.consume(this.socketClient);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    verify(payload) {
        const realPlayer = this.gameData.realPlayers[this.socketClient.id];

        if (realPlayer) {
            if(this.hasPlayingPermission(realPlayer.session)) {
                return true;
            }

            return false;
        }

        this.userSignInPublisher.publishUnauthorizedMessage(this.socketClient);
        this.socketClient.disconnect(true);

        this.logService.setTag({ id: "socket-io-id", value: this.socketClient.id });
        this.logService.setTag({ id: "username", value: payload?.username });
        this.logService.logError("User not found in server storage");
        this.logService.setTag({ id: "socket-io-id", value: "" });
        this.logService.setTag({ id: "username", value: "" });

        return false;
    }

    hasPlayingPermission(userSession) {
        if (this.gameData.gameConfigs.siteExclusions?.some((x) => x.toLowerCase() === userSession.siteName.toLowerCase())) {
            this.userSignInPublisher.publishNotPermittedToPlayMessage(this.socketClient, this.definition.id);
            return false;
        }

        return true;
    }
}
