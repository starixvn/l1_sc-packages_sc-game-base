import { Model } from "mongoose";

export default class GameDefinition {
    /**
     * @param {Model<Document,{}>} roundRepository
     * @param {Model<Document,{}>} betLogRepository
     * @param {Model<Document,{}>} betRepository
     */
    constructor(
        { id = 0, name = "", durations = {}, choices = [], defaultBetTracks = {} },
        generateResult,
        settle,
        roundRepository,
        betRepository,
        betLogRepository,
        queueingBet
    ) {
        this.id = id;
        this.name = name;
        this.configName = name.toLowerCase();
        this.durations = durations;
        this.choices = choices;
        this.defaultBetTracks = () => ({ ...defaultBetTracks });
        this.defaultTotalBets = () => ({ ...defaultBetTracks });
        this.generateResult = generateResult;
        this.settle = settle;
        this.roundRepository = roundRepository;
        this.betRepository = betRepository;
        this.betLogRepository = betLogRepository;
        this.queueingBet = queueingBet;
    }
}
