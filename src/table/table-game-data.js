import BaseGameData from "./../core/game-data";

export default class TableGameData extends BaseGameData {
    constructor(remainingTime, totalBets) {
        super(remainingTime, totalBets);

        this.chips = {};
        this.realPlayers = {};
        this.players = {};
    }
}
