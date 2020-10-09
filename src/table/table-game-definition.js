import { GameDefinition } from "./../core";

export default class TableGameDefinition extends GameDefinition {
    constructor(
        { id = 0, name = "", durations = {}, choices = [], choicesMapper = {} },
        generateResult,
        settle,
        roundRepository,
        betRepository,
        tempBetRepository,
        betLogRepository
    ) {
        super({ id, name, durations, choices, choicesMapper }, generateResult, settle, roundRepository, betRepository, betLogRepository);
        this.tempBetRepository = tempBetRepository;
    }
}
