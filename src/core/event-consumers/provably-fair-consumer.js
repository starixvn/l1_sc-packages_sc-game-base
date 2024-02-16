export default class ProvablyFairConsumer {
    MaxCombinedClientSeeds = 5;
    ClientSeedRange = { min: 0, max: 9999 };

    constructor(gameData, maxCombinedClientSeeds) {
        this.gameData = gameData;
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
    }

    generateClientSeeds(bets) {
        const clientSeeds = [];
        const sortedBets = [...bets].sort((b1, b2) => b1.time - b2.time);
        sortedBets.slice(0, this.MaxCombinedClientSeeds).forEach(({ name, clientSeed }) => clientSeeds.push({ name, clientSeed }));

        return clientSeeds;
    }

    updateClientSeeds(clientSeeds) {
        this.gameData.pf.clientSeeds = clientSeeds;
    }
}
