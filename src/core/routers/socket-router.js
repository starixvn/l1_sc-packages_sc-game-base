import { logger } from "sc-common";

import { HistoryQuery, RoundQuery } from "../query-apis";
import { PlaceBetConsumer, UserDisconnectConsumer, UserSignInConsumer } from "./../event-consumers";
import { UserSignInPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BaseSocketRouter {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {UserSignInConsumer} userSignInConsumer
     * @param {UserDisconnectConsumer} userDisconnectConsumer
     * @param {PlaceBetConsumer} placeBetConsumer
     * @param {UserSignInPublisher} userSignInPublisher
     * @param {HistoryQuery} historyQuery
     * @param {RoundQuery} roundQuery
     */
    constructor(
        definition,
        gameData,
        userSignInConsumer,
        userDisconnectConsumer = null,
        placeBetConsumer = null,
        userSignInPublisher = null,
        historyQuery = null,
        roundQuery = null
    ) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInConsumer = userSignInConsumer ?? new UserSignInConsumer(gameData);
        this.userDisconnectConsumer = userDisconnectConsumer ?? new UserDisconnectConsumer(gameData);
        this.placeBetConsumer = placeBetConsumer ?? new PlaceBetConsumer(definition, gameData);
        this.userSignInPublisher = userSignInPublisher ?? new UserSignInPublisher();
        this.historyQuery = historyQuery ?? new HistoryQuery(definition);
        this.roundQuery = roundQuery ?? new RoundQuery(definition);
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(socketClient) {
        this.socketClient = socketClient;
        this.socketClient.on("bet", this.handlePlaceBet.bind(this));
        this.socketClient.on("signin", this.handleSignIn.bind(this));
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
            logger.logError(error);
        }
    }

    async handleSignIn(payload) {
        try {
            await this.userSignInConsumer.consume(this.socketClient, payload);
        } catch (error) {
            logger.logError(error);
        }
    }

    async handleGetHistory(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            const history = await this.historyQuery.queryHistory(this.gameData.realPlayers[this.socketClient.id], payload.page);

            this.socketClient.emit(this.definition.name, history);
        } catch (error) {
            logger.logError(error);
        }
    }

    handleDisconnect() {
        try {
            this.userDisconnectConsumer.consume(this.socketClient);
        } catch (error) {
            logger.logError(error);
        }
    }

    verify(payload) {
        if (this.gameData.realPlayers[this.socketClient.id]) {
            return true;
        }

        this.userSignInPublisher.publishUnauthorizedMessage(this.socketClient);
        this.socketClient.disconnect(true);

        logger.setTag({ id: "socket-io-id", value: this.socketClient.id });
        logger.setTag({ id: "username", value: payload?.username });
        logger.logError("User not found in server storage");
        logger.setTag({ id: "socket-io-id", value: "" });
        logger.setTag({ id: "username", value: "" });

        return false;
    }
}
