export default class BaseGameData {
    constructor(remainingTime, totalBets) {
        this.remainingTime = remainingTime ?? 0;
        this.totalBets = totalBets ?? {};
        this.roundId = 1;
        this.delayStartTime = 0;
        this.disabled = false;
        this.gameConfigs = {};
        this.ingame = {};
        this.settlementResultFromAdmin = {};
    }
}
