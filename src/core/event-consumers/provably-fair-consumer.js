import GameData from "./../game-data";

export default class ProvablyFairConsumer {
    MaxCombinedClientSeeds = 5;
    ClientSeedRange = { min: 0, max: 9999 };
    bets = [];

    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {mongoose.Model} betsRepository
     * @param {mongoose.Model} tempBetsRepository
     */

    constructor(gameData, maxCombinedClientSeeds, betsRepository, tempBetsRepository) {
        this.gameData = gameData;
        this.betsRepository = betsRepository;
        this.tempBetsRepository = tempBetsRepository;

        if (maxCombinedClientSeeds) {
            this.MaxCombinedClientSeeds = maxCombinedClientSeeds;
        }
    }

    addClientSeed({ name, clientSeed }) {
        const { clientSeeds } = this.gameData.pf;

        if (clientSeeds.length < this.MaxCombinedClientSeeds) {
            clientSeeds.push({ name, clientSeed });
        }
    }

    setServerSeed(serverSeed) {
        this.gameData.pf.serverSeed = serverSeed;
    }

    setServerSeedHash(serverSeedHash) {
        this.gameData.pf.serverSeedHash = serverSeedHash;
    }

    reset() {
        this.gameData.pf = { clientSeeds: [], serverSeed: "" };
        this.bets = [];
    }

    addBets(...bets) {
        this.bets.push(...bets);
    }

    async updateClientSeedFromBets() {
        const firstBets = await this.getFirstBets(this.gameData.roundId);
        const sortedBets = this.sortByTime(firstBets);
        const chosenBets = sortedBets.slice(0, this.MaxCombinedClientSeeds);

        for (const bet of chosenBets) {
            this.addClientSeed({ name: bet.name, clientSeed: bet.clientSeed });
        }
    }

    sortByTime(bets) {
        return [...bets].sort((b1, b2) => b1.time - b2.time);
    }

    updateClientSeeds(clientSeeds) {
        this.gameData.pf.clientSeeds = clientSeeds;
    }

    async getFirstBets(roundId) {
        const betFilter = { roundId };
        const betProjection = {
            time: true,
            clientSeed: true,
            name: true,
        };
        const sortConditions = { time: 1 };

        const firstPlayerBets = await this.betsRepository
            .find(betFilter, betProjection, sortConditions)
            .limit(this.MaxCombinedClientSeeds)
            .lean()
            .exec();

        const firstBotBets = this.tempBetsRepository
            ? await this.tempBetsRepository.find(betFilter, betProjection, sortConditions).limit(this.MaxCombinedClientSeeds).lean().exec()
            : [];

        return firstPlayerBets.concat(firstBotBets);
    }
}
