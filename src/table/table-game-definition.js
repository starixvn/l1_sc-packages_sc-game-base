import GameDefinition from "../core/game-definition.js";

export default class TableGameDefinition extends GameDefinition {
    /**
     * @param {Model<Document,{}>} tempBetLogRepository
     */
    constructor(
        { id = 0, name = "", durations = {}, choices = [], defaultBetTracks = {} },
        generateResult,
        settle,
        roundRepository,
        betLogRepository,
        tempBetLogRepository
    ) {
        super({ id, name, durations, choices, defaultBetTracks }, generateResult, settle, roundRepository, betLogRepository);
        this.tempBetLogRepository = tempBetLogRepository;
    }
}
