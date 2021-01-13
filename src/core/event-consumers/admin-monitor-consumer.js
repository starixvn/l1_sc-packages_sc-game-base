import mongoose from "mongoose";

import { AdminPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class AdminMonitorConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {AdminPublisher} adminPublisher
     * @param {mongoose.Model} roundRepository
     */
    constructor(definition, gameData, adminPublisher, roundRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.adminPublisher = adminPublisher;
        this.roundRepository = roundRepository;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient) {
        const lastRound = await this.roundRepository
            .findOne({}, { id: true, result: true, settlementResult: true }, { sort: { id: -1 } })
            .lean()
            .exec();

        if (lastRound) {
            const payload = {
                roundId: lastRound.id + 1,
                result: lastRound.result,
                settlementResult: lastRound.settlementResult,
                remainingTime: this.gameData.remainingTime,
            };

            this.adminPublisher.publishToAdmin(socketClient, payload);
        }
    }
}
