export default class GameDefinition {
    constructor(
        { id = 0, name = "", durations = {}, choices = []},
        generateResult,
        settle,
        roundRepository,
        betRepository,
        betLogRepository,
        bot
    ) {
        this.id = id;
        this.name = name;
        this.configName = name.toLowerCase();
        this.durations = durations;
        this.choices = choices;       
        this.generateResult = generateResult;
        this.settle = settle;
        this.roundRepository = roundRepository;
        this.betRepository = betRepository;
        this.betLogRepository = betLogRepository;
        this.bot = bot;
    }
}
