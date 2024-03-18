import GameData from "./../game-data";

export default class ProvablyFairConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {mongoose.Model} betsRepository
     * @param {mongoose.Model} tempBetsRepository
     */

    constructor(gameData, betsRepository, tempBetsRepository) {
        this.gameData = gameData;
        this.betsRepository = betsRepository;
        this.tempBetsRepository = tempBetsRepository;
        this.maxCombinedClientSeeds = 0;
        this.limitClientSeeds = false;
    }

    setServerSeed(serverSeed) {
        this.gameData.pf.serverSeed = serverSeed;
    }

    setServerSeedHash(serverSeedHash) {
        this.gameData.pf.serverSeedHash = serverSeedHash;
    }

    setClientSeeds(clientSeeds) {
        this.gameData.pf.clientSeeds = clientSeeds;
    }

    setClientSeedsFromBets(bets) {
        const clientSeeds = bets.map((bet) => {
            return { name: bet.name, clientSeed: bet.clientSeed };
        });

        this.setClientSeeds(clientSeeds);
    }

    reset() {
        this.gameData.pf = { clientSeeds: [], serverSeed: "" };
    }

    async updateClientSeedsFromBets() {
        const allBets = await this.getBetsFromDatabase();
        const sortedBets = this.sortByTime(allBets);
        const chosenBets = this.limitClientSeeds ? sortedBets.slice(0, this.maxCombinedClientSeeds) : sortedBets;

        this.setClientSeedsFromBets(chosenBets);
    }

    sortByTime(bets) {
        return [...bets].sort((b1, b2) => b1.time - b2.time);
    }

    getBetFilter() {
        return { roundId: this.gameData.roundId };
    }

    async getBetsFromDatabase() {
        const betFilter = this.getBetFilter();
        const betProjection = {
            time: true,
            clientSeed: true,
            name: true,
        };
        const options = this.limitClientSeeds
            ? { sort: { time: 1, name: 1 }, limit: this.maxCombinedClientSeeds }
            : { sort: { time: 1, name: 1 } };

        const playerBets = await this.betsRepository.find(betFilter, betProjection, options).lean().exec();

        const botBets = this.tempBetsRepository ? await this.tempBetsRepository.find(betFilter, betProjection, options).lean().exec() : [];

        return playerBets.concat(botBets);
    }
}
