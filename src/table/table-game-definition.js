import GameDefinition from "./../core/game-definition";

export default class TableGameDefinition extends GameDefinition {
    constructor(gameSettings, generateResult, settle, generateRawResultForHash) {
        super(gameSettings, generateResult, settle, generateRawResultForHash);
        this.botSettings = gameSettings.botSettings;
    }
}
