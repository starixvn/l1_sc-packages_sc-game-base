import { Socket } from "socket.io";

import { PlayGamePermissionValidator } from "../validators";
import { InGameConsumer, PlaceBetConsumer, RedeemConsumer, UserDisconnectConsumer, UserSignInConsumer } from "./../event-consumers";
import { UserSignInPublisher } from "./../event-publishers";
import { HistoryQuery } from "./../query-apis";

export default class BaseSocketRouter {
    forbiddenCode = 403;
    waringCodes = [this.forbiddenCode];

    /**
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {UserSignInConsumer} dependencies.userSignInConsumer
     * @param {InGameConsumer} dependencies.inGameConsumer
     * @param {PlaceBetConsumer} dependencies.placeBetConsumer
     * @param {RedeemConsumer} dependencies.redeemConsumer
     * @param {UserDisconnectConsumer} dependencies.userDisconnectConsumer
     * @param {UserSignInPublisher} dependencies.userSignInPublisher
     * @param {HistoryQuery} dependencies.historyQuery
     * @param {logger} dependencies.logService
     * @param {PlayGamePermissionValidator} dependencies.playGamePermissionValidator
     * @param {RoundQuery} dependencies.roundQuery
     */
    constructor({
        definition,
        gameData,
        userSignInConsumer,
        inGameConsumer,
        placeBetConsumer,
        redeemConsumer,
        userDisconnectConsumer,
        userSignInPublisher,
        historyQuery,
        logService,
        playGamePermissionValidator,
        roundQuery,
        gameResultServiceConsumer,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInConsumer = userSignInConsumer;
        this.inGameConsumer = inGameConsumer;
        this.placeBetConsumer = placeBetConsumer;
        this.redeemConsumer = redeemConsumer;
        this.userDisconnectConsumer = userDisconnectConsumer;
        this.userSignInPublisher = userSignInPublisher;
        this.historyQuery = historyQuery;
        this.logService = logService;
        this.playGamePermissionValidator = playGamePermissionValidator;
        this.roundQuery = roundQuery;
        this.gameResultServiceConsumer = gameResultServiceConsumer;
    }

    /**
     * @param {Socket} socketClient
     */
    init(socketClient) {
        this.socketClient = socketClient;
        this.socketClient.on("bet", this.handlePlaceBet.bind(this));
        this.socketClient.on("signin", this.handleSignIn.bind(this));
        this.socketClient.on("inGame", this.handleInGame.bind(this));
        this.socketClient.on("getHistory", this.handleGetHistory.bind(this));
        this.socketClient.on("disconnect", this.handleDisconnect.bind(this));
        this.socketClient.on("getRoundPF", this.handleGetRoundPF.bind(this));
        this.socketClient.on("betDetails", this.handleBetDetails.bind(this));
        this.socketClient.on("redeem", this.handleRedeem.bind(this));
    }

    async handleBetDetails(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            const { playerId, operatorId, siteId } = this.gameData.realPlayers[this.socketClient.id].session;
            const { mode, timeZoneOffset, roundId, language } = payload;

            const result = await this.gameResultServiceConsumer.getUrl({ playerId, operatorId, siteId, roundId, mode, timeZoneOffset, language });

            if (result.isAuthenticated) {
                this.socketClient.emit(this.definition.name, { betDetailsUrl: result.redirectUrl });
            }
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleGetRoundPF(payload) {
        try {
            if (!this.definition.provablyFair || !this.verify() || payload.roundId > this.gameData.roundId) {
                return;
            }

            const result = await this.roundQuery.getRoundPF(payload.roundId);

            this.socketClient.emit(this.definition.name, result);
        } catch (error) {
            this.logService.logError(error);
        }
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

    handleRedeem(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            this.redeemConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleSignIn(payload) {
        try {
            await this.userSignInConsumer.consume(this.socketClient, payload);
        } catch (error) {
            this.handleError(payload, error);
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
            return this.playGamePermissionValidator.validate(realPlayer.session, this.socketClient);
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

    handleError(payload, e) {
        const message = `Error when signin: ${JSON.stringify(payload)}. ${e}`;

        if (this.waringCodes.includes(e.response?.status)) {
            this.logService.logWarning(message);
        } else {
            this.logService.logError(message);
        }
    }
}
