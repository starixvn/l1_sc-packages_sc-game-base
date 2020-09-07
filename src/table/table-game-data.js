import GameData from "./../core/game-data";

export default class TableGameData extends GameData {
    constructor(remainingTime, totalBets) {
        super(remainingTime, totalBets);

        this.chips = {};
        this.players = {};
    }
}
