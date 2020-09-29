export default class GameData {
    constructor(remainingTime) {
        this.remainingTime = remainingTime ?? 0;
        this.totalBets = {};
        this.roundId = 1;
        this.delayStartTime = 0;
        this.disabled = false;
        this.gameConfigs = {};
        this.realPlayers = {};
        this.ingame = {};
        this.admins = {};
        this.settlementResultFromAdmin = {};
    }
}
