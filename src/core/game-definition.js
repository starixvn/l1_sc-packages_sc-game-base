import { Model } from "mongoose";

export default class GameDefinition {
    /**
     * @param {Model<Document,{}>} roundRepository
     * @param {Model<Document,{}>} betLogRepository
     */
    constructor({ id = 0, name = "", durations = {}, choices = [] }, generateResult, settlementRule, roundRepository, betLogRepository) {
        this.id = id;
        this.name = name;
        this.configName = name.toLowerCase();
        this.viewName = `view${name}`;
        this.durations = durations;
        this.choices = choices;
        this.generateResult = generateResult;
        this.settlementRule = settlementRule;
        this.roundRepository = roundRepository;
        this.betLogRepository = betLogRepository;
    }
}
