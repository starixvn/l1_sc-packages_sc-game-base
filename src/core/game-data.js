export default class GameData {
    constructor(remainingTime) {
        const MILLISECONDS_IN_MINUTE = 60000;
        this.remainingTime = remainingTime ?? 0;
        this.totalBets = {};
        this.roundId = 1;
        this.delayStartTime = 0;
        this.disabled = true;
        this.gameConfigs = {};
        this.realPlayers = {};
        this.ingame = {};
        this.admins = {};
        this.settlementResultFromAdmin = {};
        this.umMessages = {};
        this.exchangeRates = {};
        this.currencyGroupGames = [];
        this.currencies = [];
        this.currencyGroups = [];
        this.partnerGameSiteExclusions = [];
        this.resultHash = {};
        this.winningPlayers = {};
        this.pf = { clientSeeds: [], serverSeed: "", serverSeedHash: "" };
        
        this.lastMinuteCheck = Math.floor(Date.now() / MILLISECONDS_IN_MINUTE);
    }
}
