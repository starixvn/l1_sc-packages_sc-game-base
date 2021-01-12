import mongoose from "mongoose";

import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class AdminMonitorConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {mongoose.Model} roundRepository
     */
    constructor(definition, gameData, publisher, roundRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher;
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

            socketClient.emit("message", { [this.definition.name]: payload });
        }
    }
}
