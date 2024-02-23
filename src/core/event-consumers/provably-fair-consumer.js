export default class ProvablyFairConsumer {
    MaxCombinedClientSeeds = 5;
    ClientSeedRange = { min: 0, max: 9999 };
    bets = [];

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
        this.bets = [];
    }

    addBets(...bets) {
        this.bets.push(...bets);
    }

    updateClientSeedFromBets() {
        const sortedBets = [...this.bets].sort((b1, b2) => b1.time - b2.time);
        const chosenBets = sortedBets.slice(0, this.MaxCombinedClientSeeds);

        for (const bet of chosenBets) {
            this.addClientSeed({ name: bet.name, clientSeed: bet.clientSeed });
        }
    }

    updateClientSeeds(clientSeeds) {
        this.gameData.pf.clientSeeds = clientSeeds;
    }
}
