import mongoose from "mongoose";

import GameManagementApiClientFactory, { getOrDefault } from "../game-management-api";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class RoundIdConsumer {
    /**
     *
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     */

    constructor(gameData, definition, roundsRepository, gameManagementApiClientFactory) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundsRepository = roundsRepository;
        this.gameManagementApiClient = gameManagementApiClientFactory.instance();
    }

    async initRoundId() {
        const lastRound = await this.roundsRepository
            .findOne({}, "id", { sort: { id: -1 } })
            .lean()
            .exec();

        if (lastRound) {
            this.gameData.roundId = lastRound.id + 1;
        } else {
            this.gameData.roundId = await this.getLastArchiveRound();
        }
    }

    async getLastArchiveRound() {
        const { configName } = this.definition;
        const archiveStatus = await getOrDefault(this.gameManagementApiClient.archiveStatus.getArchiveStatus(configName));

        return archiveStatus ? (archiveStatus.lastArcId["_phiens"] ?? archiveStatus.lastArcId["_rounds"]) + 1 : 1;
    }
}
