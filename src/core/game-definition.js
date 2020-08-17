import { Model } from "mongoose";

export default class GameDefinition {
    /**
     * @param {Model<Document,{}>} roundRepository
     * @param {Model<Document,{}>} betLogRepository
     */
    constructor(
        { id = 0, name = "", durations = {}, choices = [], defaultBetTracks = {} },
        generateResult,
        settle,
        roundRepository,
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
        this.betLogRepository = betLogRepository;
        this.queueingBet = queueingBet;
    }
}
