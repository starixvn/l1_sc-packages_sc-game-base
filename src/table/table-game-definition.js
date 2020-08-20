import { GameDefinition } from "./../core";

export default class TableGameDefinition extends GameDefinition {
    constructor(
        { id = 0, name = "", durations = {}, choices = [], choicesMapper = {}, defaultBetTracks = {} },
        generateResult,
        settle,
        roundRepository,
        betRepository,
        tempBetRepository,
        betLogRepository,
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
    }
}
