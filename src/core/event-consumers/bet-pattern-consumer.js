import Chance from "chance";
import moment from "moment";
import mongoose from "mongoose";

import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BetPatternConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} betPatternRepository
     * @param {mongoose.Model} betActionRepository
     */
    constructor({ definition, gameData, userInfosRepository, betPatternRepository, betActionRepository }) {
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
        this.patternExpiryTime = 24;
    }

    async resetAndUpdatePatterns() {
        if (this.gameData.gameConfigs?.smartBotEnabled) {
            const currentTime = moment.utc();
            const isExpired =
                this.isExpired(currentTime, this.patternExpiryTime) ||
                this.currentRatioOfGroups !== this.gameData.gameConfigs.smartBotGroupRatio;

            if (isExpired) {
                await this.generateGroupedPatterns();
                this.patterns = await this.randomPickedByGroup(this.followingDatePattern);
                this.currentRatioOfGroups = this.gameData.gameConfigs.smartBotGroupRatio;

                await this.assignPatterns();
            }

            await this.getBetActionsInTimeFrame(currentTime);

            return isExpired;
        } else {
            this.patterns = [];
            this.betActions = [];
        }

        return false;
    }

    isExpired(currentTime, botPatternExpiredInHours) {
        if (this.expiredTime < currentTime) {
            this.expiredTime = moment().startOf("day").add(botPatternExpiredInHours, "hours");

            return true;
        }

        return false;
    }

    async generateGroupedPatterns() {
        const highStakePatternsByDate = await this.betPatternRepository.aggregate([{ $sample: { size: 1 } }]).exec();
        this.followingDatePattern = highStakePatternsByDate[0].time;
        this.betActions = [];
    }

    async randomPickedByGroup(time) {
        const allGroups = await this.betPatternRepository.find({ time: time }, "_id group").lean().exec();
        const distinctGroups = [...new Set(allGroups.map((pattern) => pattern.group))];
        const pickedGroups = this.chance.pickset(
            distinctGroups,
            Math.round(distinctGroups.length * this.gameData.gameConfigs.smartBotGroupRatio)
        );

        return allGroups.filter((pattern) => pickedGroups.includes(pattern.group));
    }

    async getBetActionsInTimeFrame(currentTime) {
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
            }
        }
    }

    getBetActions(patternId) {
        return this.betActions.filter((action) => action.patId === patternId);
    }

    async assignPatterns() {}
}
