import GameData from "./../game-data";
import GameDefinition from "./../game-definition";
import { SeedHelper, ServerSeedHelper } from "../helpers";

export default class RoundResultConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {mongoose.Model} roundsRepository
     * @param {mongoose.Model} resultsRepository
     * @param {ProvablyFairConsumer} dependencies.provablyFairConsumer
     */

    constructor(gameData, definition, roundResultPublisher, resultsRepository, provablyFairConsumer) {
        this.gameData = gameData;
        this.definition = definition;
        this.roundResultPublisher = roundResultPublisher;
        this.resultsRepository = resultsRepository;
        this.provablyFairConsumer = provablyFairConsumer;
    }

    async generateResult() {
        if (!this.generateResultFromAdmin()) {
            await this.generateAndUpdatePfWithFinalSeeds();

            const data = this.getDataForGenerateResult();

            this.gameData.result = this.definition.generateResult(data);
        }
    }

    generateResultFromAdmin() {
        const { roundId, settlementResultFromAdmin: resultFromAdmin } = this.gameData;

        if (roundId === resultFromAdmin.roundId) {
            this.gameData.result = resultFromAdmin.result;
            return true;
        }

        return false;
    }

    getDataForGenerateResult() {
        return this.gameData.pf.finalHash;
    }

    getResultFilter() {
        return { roundId: this.gameData.roundId };
    }

    async generateAndUpdatePfWithFinalSeeds() {
        if (!this.definition.provablyFair) {
            return;
        }

        const resultFilter = this.getResultFilter();
        const { serverSeed, serverSeedHash } = this.gameData.pf;
        const finalSeeds = this.generateFinalSeeds();

        await this.resultsRepository.findOneAndUpdate(resultFilter, {
            ...finalSeeds,
        });

        this.gameData.pf = { ...finalSeeds, serverSeed, serverSeedHash };
    }

    generateFinalSeeds() {
        const { serverSeed, clientSeeds } = this.gameData.pf;
        const mergeClientSeed = SeedHelper.getMergeClientSeed(clientSeeds);
        const mergeSeed = serverSeed + mergeClientSeed;
        const finalHash = SeedHelper.getSHA512Hash(mergeSeed);

        return { clientSeeds, mergeClientSeed, mergeSeed, finalHash };
    }

    async generateServerSeedAndPublishHash() {
        const serverSeed = this.generateServerSeed();
        const serverSeedHash = SeedHelper.getSHA256Hash(serverSeed);

        this.provablyFairConsumer.setServerSeed(serverSeed);
        this.provablyFairConsumer.setServerSeedHash(serverSeedHash);

        await this.createResultRecord(serverSeed, serverSeedHash);

        this.roundResultPublisher.publishServerSeedHash();
    }

    generateServerSeed() {
        const { randomMode } = this.gameData.gameConfigs;

        return ServerSeedHelper.generateServerSeed(randomMode);
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
