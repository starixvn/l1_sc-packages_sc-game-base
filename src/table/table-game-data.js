import BaseGameData from "./../core/game-data";

export default class TableGameData extends BaseGameData {
    constructor() {
        super();

        this.chips = {};
        this.realPlayers = {};
        this.players = {};
    }
}
