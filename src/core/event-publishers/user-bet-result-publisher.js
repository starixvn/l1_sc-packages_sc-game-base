import { logger } from "sc-common";

import * as authenticationHelper from "./../helpers/authentication-helper";
import BaseEventPublisher from "./base-event-publisher";

export default class UserBetResultPublisher extends BaseEventPublisher {
    constructor(gameName, gameData) {
        super(gameName, gameData);
    }

    async publish(userId, betResult) {
        const status = { winningByChoices: betResult.winningByChoices };

        if (betResult.totalWin > 0) {
            status.win = true;
            status.bet = betResult.totalWin;
        } else {
            status.win = false;
            status.bet = betResult.totalLost;
        }

        await this.publishToUser(userId, { status });
    }

    async publishToUser(userId, payload, path = this.gameName) {
        const realPlayer = Object.values(this.gameData.realPlayers).find(
            (player) => player.UID === userId && player.socketClient && player.socketClient.connected
        );

        if (realPlayer && realPlayer.socketClient) {
            realPlayer.socketClient.emit(path, payload);
        } else {
            await this.refreshBalance(userId);
        }
    }

    async refreshBalance(userId) {
        try {
            await authenticationHelper.post("refreshBalance", { uid: userId });
        } catch (error) {
            logger.logError(error);
        }
    }
}
