export default class GameDefinition {
    constructor(
        {
            id = 0,
            name = "",
            durations = {},
            choices = [],
            choicesMapper = {},
            hedgeBetGroups = [],
            numberOfRoundHistory = 100,
            historyPageSize = 8,
            provablyFair = false,
        },
        generateResult,
        settle,
        generateRawResultForHash
    ) {
        this.id = id;
        this.name = name;
        this.configName = name.toLowerCase();
        this.durations = durations;
        this.choices = choices;
        this.choicesMapper = choicesMapper;
        this.numberOfRoundHistory = numberOfRoundHistory;
        this.historyPageSize = historyPageSize;
        this.generateResult = generateResult;
        this.settle = settle;
        this.generateRawResultForHash = generateRawResultForHash;
        this.hedgeBetGroups = hedgeBetGroups;
        this.provablyFair = provablyFair;
    }
}
