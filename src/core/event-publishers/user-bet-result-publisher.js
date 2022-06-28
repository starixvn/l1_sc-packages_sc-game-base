import { logger } from "sc-common";

import GameData from "./../game-data";
import BaseEventPublisher from "./base-event-publisher";

export default class UserBetResultPublisher extends BaseEventPublisher {
    /**
     * @param {string} gameName
     * @param {GameData} gameData
     * @param {logger} logService
     */
    constructor(gameName, gameData, logService) {
        super(gameName, gameData);

        this.logService = logService;
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
        }
    }
}
