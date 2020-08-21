import { helpers } from "sc-common";

import { BasePublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class PlaceBetConsumer {
    /**
     * @param {BasePublisher} publisher
     * @param {GameData} gameData
     * @param {GameDefinition} definition
     */

    constructor(definition, gameData, publisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.gameName = definition.name;
        this.publisher = publisher ?? new BasePublisher(this.gameName, gameData);
    }

    validateBetRequest(player, betChoice, amount) {
        if (!amount || !betChoice) {
            return false;
        }

        const configs = this.gameData.gameConfigs;
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };
        const totalAmount = this.definition.choices.reduce((total, choice) => total + (betTracks[choice] || 0), 0) + amount;
        const maxBetPerChoice = configs.choices_maxbet[betChoice] || 0;

        const defaultCriteria = [
            {
                failure: !configs.enabled,
                notice: helpers.noticeHelper.placeBetNextRound,
            },
            {
                failure:
                    this.gameData.remainingTime < this.definition.durations.lockingBet ||
                    this.gameData.remainingTime >= this.definition.durations.placingBets,
                notice: helpers.noticeHelper.placeBetNextRound,
            },
            {
                failure: amount > maxBetPerChoice || betTracks[betChoice] + amount > maxBetPerChoice,
                notice: helpers.noticeHelper.maxBetForChoice(maxBetPerChoice),
            },
            {
                failure: amount < configs.minbet,
                notice: helpers.noticeHelper.minBet(configs.minbet),
            },
            {
                failure: amount > configs.maxbet,
                notice: helpers.noticeHelper.maxBet(configs.maxbet),
            },
            {
                failure: totalAmount > configs.maxbet,
                notice: helpers.noticeHelper.maxBet(configs.maxbet),
            },
        ];

        const criteria = this.definition.additionalValidationCriteria
            ? this.definition.additionalValidationCriteria.concat(defaultCriteria)
            : defaultCriteria;
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    async placeBet(player, payload) {
        const amount = payload.amount >> 0;
        const betChoice = payload.betChoice;

        if (!this.validateBetRequest(player, betChoice, amount)) {
            return;
        }

        const name = player.profile.name;

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                betTracks: {},
                betQueue: [],
            };

            this.gameData.ingame[name] = newPlayer;
        }

        this.gameData.ingame[name].betQueue.push({ player, payload });
    }
}
