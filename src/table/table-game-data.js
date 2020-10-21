import GameData from "./../core/game-data";

export default class TableGameData extends GameData {
    constructor(remainingTime) {
        super(remainingTime);

        this.chips = {};
        this.players = {};
    }
}
