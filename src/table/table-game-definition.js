import { GameDefinition } from "../core";

export default class TableGameDefinition extends GameDefinition {
    /**
     * @param {Model<Document,{}>} tempBetLogRepository
     */
    constructor(
        { id = 0, name = "", durations = {}, choices = [], choicesMapper = {}, defaultBetTracks = {} },
        generateResult,
        settle,
        roundRepository,
        betRepository,
        tempBetRepository,
        betLogRepository,
        tempBetLogRepository,
        bot
    ) {
        super(
            { id, name, durations, choices, choicesMapper, defaultBetTracks },
            generateResult,
            settle,
            roundRepository,
            betRepository,
            betLogRepository,
            bot
        );
        this.tempBetRepository = tempBetRepository;
        this.tempBetLogRepository = tempBetLogRepository;
    }
}
