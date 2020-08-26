import { logger } from "sc-common";

import { HistoryQuery, RoundQuery } from "../query-apis";
import { PlaceBetConsumer, UserDisconnectConsumer, UserSignInConsumer } from "./../event-consumers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BaseSocketRouter {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {UserSignInConsumer} userSignInConsumer
     * @param {UserDisconnectConsumer} userDisconnectConsumer
     * @param {PlaceBetConsumer} placeBetConsumer
     * @param {HistoryQuery} historyQuery
     * @param {RoundQuery} roundQuery
     */
    constructor(
        definition,
        gameData,
        userSignInConsumer,
        userDisconnectConsumer = null,
        placeBetConsumer = null,
        historyQuery = null,
        roundQuery = null
    ) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInConsumer = userSignInConsumer ?? new UserSignInConsumer(gameData);
        this.userDisconnectConsumer = userDisconnectConsumer ?? new UserDisconnectConsumer(gameData);
        this.placeBetConsumer = placeBetConsumer ?? new PlaceBetConsumer(definition, gameData);
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

    async handlePlaceBet(payload) {
        await this.placeBetConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload).catch(logger.logError);
    }

    async handleSignIn(payload) {
        await this.userSignInConsumer.consume(this.socketClient, payload).catch(logger.logError);
    }

    async handleGetHistory(payload) {
        try {
            const history = await this.historyQuery.queryHistory(this.gameData.realPlayers[this.socketClient.id], payload.page);

            this.socketClient.emit(this.definition.name, history);
        } catch (err) {
            logger.logError(err);
        }
    }

    async handleDisconnect(reason) {
        try {
            this.userDisconnectConsumer.consume(this.socketClient, reason);
            this.socketClient.disconnect();
        } catch (err) {
            logger.logError(err);
        }
    }
}
