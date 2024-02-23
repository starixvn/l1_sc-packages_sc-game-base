import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import { SeedHelper, ServerSeedHelper } from "../helpers";

export default class RoundResultConsumer {
    /**
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {mongoose.Model} roundsRepository
     * @param {mongoose.Model} resultsRepository
     */

    constructor(gameData, definition, roundResultPublisher, resultsRepository) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.resultsRepository = resultsRepository;
    }

    async generateResult() {
        const { roundId, pf, settlementResultFromAdmin: resultFromAdmin } = this.gameData;

        if (roundId === resultFromAdmin.roundId) {
            this.gameData.result = resultFromAdmin.result;
            return;
        }

        const finalSeeds = await this.getFinalSeeds(roundId, pf);

        this.gameData.result = this.definition.generateResult(finalSeeds.finalHash);
    }

    async getFinalSeeds(roundId, pf) {
        if (!this.definition.provablyFair) return {};

        const { serverSeed, serverSeedHash } = pf;
        const finalSeeds = this.generateFinalSeeds(pf);

        await this.resultsRepository.findOneAndUpdate(
            { roundId },
            {
                ...finalSeeds,
            }
        );

        this.gameData.pf = { ...finalSeeds, serverSeed, serverSeedHash };

        return finalSeeds;
    }

    generateFinalSeeds(pf) {
        const { serverSeed, clientSeeds } = pf;
        const mergeClientSeed = SeedHelper.getMergeClientSeed(clientSeeds);
        const mergeSeed = serverSeed + mergeClientSeed;
        const finalHash = SeedHelper.getSHA512Hash(mergeSeed);

        return { clientSeeds, mergeClientSeed, mergeSeed, finalHash };
    }

    async generateServerSeedAndPublishHash() {
        const { randomMode } = this.gameData.gameConfigs;
        const serverSeed = ServerSeedHelper.generateServerSeed(randomMode);
        const serverSeedHash = SeedHelper.getSHA256Hash(serverSeed);

        this.gameData.pf = { ...this.gameData.pf, serverSeed, serverSeedHash };

        await this.createResultRecord(serverSeed, serverSeedHash);

        this.roundResultPublisher.publishServerSeedHash();
    }

    async createResultRecord(serverSeed, serverSeedHash) {
        await this.resultsRepository.create({
            roundId: this.gameData.roundId,
            serverSeedHash: serverSeedHash,
            serverSeed: serverSeed,
            time: new Date(),
        });
    }
}
