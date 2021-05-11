import { helpers } from "sc-common";

import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class PlaceBetConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {BaseEventPublisher} publisher
     */
    constructor(definition, gameData, publisher) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher;
    }

    composeValidationCriteria(player, betChoice, amount, freeBet) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria() ?? [];
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) || [];
        const betChoiceValidationCriteria = this.composeBetChoiceValidationCriteria(betChoice) || [];

        return bettingTimeValidationCriteria.concat(betAmountValidationCriteria, betChoiceValidationCriteria);
    }

    composeBettingTimeValidationCriteria() {
        const configs = this.gameData.gameConfigs;

        return [
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
        ];
    }

    composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) {
        const configs = this.gameData.gameConfigs;
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };
        const totalAmount = this.definition.choices.reduce((total, choice) => total + (betTracks[choice] || 0), 0) + amount;
        const minBet = Math.max(player.profile.minBet, configs.minbet);
        const maxBet = Math.min(player.profile.maxBet, configs.maxbet);
        const maxBetPerChoice = Math.min(player.profile.maxBet, configs.choices_maxbet[betChoice]);

        return [
            {
                failure: freeBet && !configs.enableFreeBet,
                notice: helpers.noticeHelper.invalidBet,
            },
            {
                failure: amount > maxBetPerChoice || betTracks[betChoice] + amount > maxBetPerChoice,
                notice: helpers.noticeHelper.maxBetForChoice(maxBetPerChoice),
            },
            {
                failure: amount < minBet,
                notice: helpers.noticeHelper.minBet(minBet),
            },
            {
                failure: amount > maxBet,
                notice: helpers.noticeHelper.maxBet(maxBet),
            },
            {
                failure: totalAmount > maxBet,
                notice: helpers.noticeHelper.maxBet(maxBet),
            },
        ];
    }

    composeBetChoiceValidationCriteria(betChoice) {
        return [
            {
                failure: !this.definition.choices.includes(betChoice),
                notice: helpers.noticeHelper.invalidBet,
            },
        ];
    }

    validateBetRequest(player, betChoice, amount, freeBet) {
        if (!amount || !betChoice) {
            return false;
        }

        const criteria = this.composeValidationCriteria(player, betChoice, amount, freeBet);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, betChoice, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    consume(player, payload) {
        Object.assign(payload, {
            amount: payload.amount >> 0,
            freeBet: payload.freeBet ?? false,
        });

        const { amount, betChoice, freeBet } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, betChoice, amount, freeBet)) {
            return;
        }

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                currency: player.session.currency,
                system: player.session.system,
                betTracks: {},
                betQueue: [],
            };

            this.gameData.ingame[name] = newPlayer;
        }

        this.adjustBetTracks(player.profile.name, payload);
        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    adjustBetTracks(playerName, bet) {
        const { betChoice, amount } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[betChoice] = (playerInGame.betTracks[betChoice] ?? 0) + amount;
        }
    }
}
