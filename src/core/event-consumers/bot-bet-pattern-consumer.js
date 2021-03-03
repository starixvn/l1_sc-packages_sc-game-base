import Chance from "chance";
import moment from "moment";
import mongoose from "mongoose";

import GameData from "./../../game-data";
import GameDefinition from "./../../game-definition";

export default class BotBetPatternConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} betPatternRepository
     * @param {mongoose.Model} betActionRepository
     */
    constructor(definition, gameData, userInfosRepository, betPatternRepository, betActionRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.userInfosRepository = userInfosRepository;
        this.betPatternRepository = betPatternRepository;
        this.betActionRepository = betActionRepository;

        this.followingDatePattern = null;
        this.currentRatioOfGroups = 0;
        this.patterns = [];
        this.betActions = [];
        this.expiredTime = moment.utc();
        this.chance = new Chance();
    }

    async reset() {
        if (this.gameData.gameConfigs?.smartBotEnabled) {
            const currentTime = moment.utc();

            await this.generateGroupedPatterns(currentTime, this.definition.botPatternExpiredInHours);

            if (this.currentRatioOfGroups !== this.gameData.gameConfigs.smartBotTotalGroup) {
                this.patterns = await this.randomPickedByGroup(this.followingDatePattern);
                this.currentRatioOfGroups = this.gameData.gameConfigs.smartBotTotalGroup;
                await this.assignBotsForGroupPattern(this.patterns.length);
            }

            await this.assignBetPattern(currentTime);
        } else {
            this.patterns = [];
            this.betActions = [];
            this.bots = [];
        }
    }

    async generateGroupedPatterns(currentTime, botPatternExpiredInHours) {
        if (this.expiredTime < currentTime) {
            this.expiredTime = moment.utc().add(botPatternExpiredInHours, "hours");

            const highStakePatternsByDate = await this.betPatternRepository.aggregate([{ $sample: { size: 1 } }]).exec();
            this.followingDatePattern = highStakePatternsByDate[0].time;
            this.bots = [];
            this.betActions = [];
        }
    }

    async randomPickedByGroup(time) {
        const allGroups = await this.betPatternRepository.find({ time: time }, "_id group").lean().exec();
        const distinctGroups = [...new Set(allGroups.map((pattern) => pattern.group))];
        const pickedGroups = this.chance.pickset(
            distinctGroups,
            Math.round(distinctGroups.length * this.gameData.gameConfigs.smartBotTotalGroup)
        );

        return allGroups.filter((pattern) => pickedGroups.includes(pattern.group));
    }

    async assignBotsForGroupPattern(totalBot) {
        if (this.bots.length === 0) {
            //Assign pattern id to specific bot
        }
    }

    async assignBetPattern(currentTime) {
        if (this.patterns.length > 0) {
            const startTime = currentTime.valueOf() % (24 * 3600 * 1000);
            const endTime = startTime + this.definition.durations.wholeRound * 1000;

            const times = await this.betActionRepository
                .find({ patId: { $in: this.patterns }, time: { $gt: startTime, $lt: endTime } })
                .distinct("time")
                .lean()
                .exec();

            if (times.length > 0) {
                this.betActions = await this.betActionRepository
                    .find({ time: { $in: times } })
                    .lean()
                    .exec();

                for (let index = 0; index < this.patterns.length; index++) {
                    if (this.bots[index]) {
                        this.bots[index].patternId = this.patterns[index]._id;
                        this.bots[index].betActions = this.betActions.filter((action) => action.patId === this.patterns[index]._id) ?? [];
                    }
                }
            }
        }
    }
}
