import { GameDefinition } from "./../core";

export default class TableGameDefinition extends GameDefinition {
    constructor(
        { id = 0, name = "", durations = {}, choices = [], choicesMapper = {}, numberOfRoundHistory = 100 },
        generateResult,
        settle,
        roundRepository,
        betRepository,
        tempBetRepository,
        betLogRepository
    ) {
        super(
            { id, name, durations, choices, choicesMapper, numberOfRoundHistory },
            generateResult,
            settle,
            roundRepository,
            betRepository,
            betLogRepository
        );
        this.tempBetRepository = tempBetRepository;
    }
}
