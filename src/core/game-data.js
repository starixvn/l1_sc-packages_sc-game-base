export default class BaseGameData {
    constructor() {
        this.roundId = -1;
        this.remainingTime = 0;
        this.delayStartTime = 0;
        this.disabled = true;
        this.totalBets = {};
        this.gameConfigs = {};
        this.ingame = {};
        this.settlementResultFromAdmin = {};
    }
}
