export default class UnsettledRoundConsumer {
    constructor({
        gameData,
        definition,
        betsRepository,
        betLogsRepository,
        tempBetsRepository,
        settleGameRoundConsumer,
        roundResultConsumer,
        provablyFairConsumer,
    }) {
        this.gameData = gameData;
        this.definition = definition;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.tempBetsRepository = tempBetsRepository;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundResultConsumer = roundResultConsumer;
        this.provablyFairConsumer = provablyFairConsumer;
    }

    async proceed() {
        if (this.gameData.lastResultRecord) {
            const unsettledBets = await this.getUnsettledBets(this.gameData.roundId);
            await this.generateResult(unsettledBets);
            await this.proceedUnsettledBets(unsettledBets);

            await this.settleGameRoundConsumer.settleRound();
        }
    }

    async proceedUnsettledBets(unsettledBets) {}

    async generateResult(unsettledBets) {
        const { serverSeed, serverSeedHash, finalHash } = this.gameData.lastResultRecord;

        if (finalHash) {
            this.gameData.result = this.definition.generateResult(finalHash);
        } else {
            await this.provablyFairConsumer.updateClientSeedFromBets();
            this.provablyFairConsumer.setServerSeed(serverSeed);
            this.provablyFairConsumer.setServerSeedHash(serverSeedHash);
            await this.roundResultConsumer.generateResult();
        }
    }

    async getUnsettledBets(roundId) {
        const playerBets = await this.betsRepository.find({ paid: false, roundId }).lean().exec();
        const botBets = this.tempBetsRepository ? await this.tempBetsRepository.find({ paid: false, roundId }).lean().exec() : [];

        return playerBets.concat(botBets);
    }
}
