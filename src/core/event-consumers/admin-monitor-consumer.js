import mongoose from "mongoose";
import { Socket } from "socket.io";

import { AdminPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class AdminMonitorConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {AdminPublisher} adminPublisher
     * @param {mongoose.Model} roundsRepository
     */
    constructor(definition, gameData, adminPublisher, roundsRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.adminPublisher = adminPublisher;
        this.roundsRepository = roundsRepository;
    }

    /**
     * @param {Socket} socketClient
     */
    async consume(socketClient) {
        const lastRound = await this.roundsRepository
            .findOne({}, { id: true, result: true, settlementResult: true }, { sort: { id: -1 } })
            .lean()
            .exec();

        if (lastRound) {
            const payload = {
                roundId: lastRound.id + 1,
                result: lastRound.result,
                settlementResult: lastRound.settlementResult,
                remainingTime: this.gameData.remainingTime,
                currencies: this.gameData.currencies,
                exchangeRates: this.gameData.exchangeRates,
                partners: this.gameData.partners,
            };

            this.adminPublisher.publishToAdmin(socketClient, payload);
        }
    }
}
