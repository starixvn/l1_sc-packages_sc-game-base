export default class BaseGameData {
    constructor() {
        this.roundId = -1;
        this.remainingTime = 0;
        this.totalBets = {};
        this.gameConfigs = {};
        this.ingame = {};
    }
}
