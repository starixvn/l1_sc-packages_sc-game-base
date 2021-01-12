export default class GameDefinition {
    constructor(
        { id = 0, name = "", durations = {}, choices = [], choicesMapper = {}, numberOfRoundHistory = 100 },
        generateResult,
        settle
    ) {
        this.id = id;
        this.name = name;
        this.configName = name.toLowerCase();
        this.durations = durations;
        this.choices = choices;
        this.choicesMapper = choicesMapper;
        this.numberOfRoundHistory = numberOfRoundHistory;
        this.generateResult = generateResult;
        this.settle = settle;
    }
}
