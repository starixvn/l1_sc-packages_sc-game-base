import { helpers } from "sc-common";

import { BaseEventPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class PlaceBetConsumer {
    DisplayMode = {
        Landscape: "1",
        Portrait: "2",
    };

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

    composeValidationCriteria(player, betChoice, amount, freeBet, roundId) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(roundId) ?? [];
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) || [];
        const betChoiceValidationCriteria = this.composeBetChoiceValidationCriteria(betChoice) || [];
        const hedgeBetValidationCriteria = this.composeHedgeBetValidationCriteria(betChoice, player) || [];

        return bettingTimeValidationCriteria.concat(betChoiceValidationCriteria, betAmountValidationCriteria, hedgeBetValidationCriteria);
    }

    composeBettingTimeValidationCriteria(roundId) {
        const configs = this.gameData.gameConfigs;

        return [
            {
                failure: !configs.enabled,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: roundId !== this.gameData.roundId,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet, { gameRoundId: roundId }),
            },
            {
                failure:
                    this.gameData.remainingTime < this.definition.durations.lockingBet ||
                    this.gameData.remainingTime >= this.definition.durations.placingBets,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];
    }

    composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) {
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const configs = this.gameData.gameConfigs;
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };
        const totalAmount = this.definition.choices.reduce((total, choice) => total + (betTracks[choice] || 0), 0) + amount;
        const minBet = Math.max(player.profile.minBet, settings.minBet);
        const maxBet = Math.min(player.profile.maxBet, settings.maxBet);
        const maxBetPerChoice = Math.min(player.profile.maxBet, settings.maxBetPerChoices[betChoice]);

        return [
            {
                failure: freeBet && !configs.enableFreeBet,
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
            {
                failure: amount > maxBetPerChoice || betTracks[betChoice] + amount > maxBetPerChoice,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBetForChoice, { maxBet: maxBetPerChoice }),
            },
            {
                failure: amount < minBet,
                notice: this.getNoticeObj(helpers.noticeHelper.minBet, { minBet }),
            },
            {
                failure: amount > maxBet,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBet, { maxBet }),
            },
            {
                failure: totalAmount > maxBet,
                notice: this.getNoticeObj(helpers.noticeHelper.maxBet, { maxBet }),
            },
        ];
    }

    getNoticeObj(errorCode, extraData) {
        return {
            errorCode,
            ...extraData,
        };
    }

    composeBetChoiceValidationCriteria(betChoice) {
        return [
            {
                failure: !this.definition.choices.includes(betChoice),
                notice: this.getNoticeObj(helpers.noticeHelper.invalidBet),
            },
        ];
    }

    composeHedgeBetValidationCriteria(betChoice, player) {
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };
        const hedgeBetGroup = this.definition.hedgeBetGroups.find((group) => group.includes(betChoice));

        const isInvalid =
            hedgeBetGroup &&
            Object.keys(betTracks).some((betKey) => betTracks[betKey] && hedgeBetGroup.includes(betKey) && betKey !== betChoice);

        return [
            {
                failure: isInvalid,
                notice: this.getNoticeObj(helpers.noticeHelper.disallowHedgeBet, { hedgeBetGroup }),
            },
        ];
    }

    validateBetRequest(player, betChoice, amount, freeBet, roundId) {
        if (!amount || !betChoice) {
            return false;
        }

        const criteria = this.composeValidationCriteria(player, betChoice, amount, freeBet, roundId);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, betChoice, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    consume(player, payload) {
        Object.assign(payload, {
            amount: +payload.amount,
            freeBet: payload.freeBet ?? false,
            roundId: payload.roundId ?? this.gameData.roundId,
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
        });

        const { amount, betChoice, freeBet, roundId } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, betChoice, amount, freeBet, roundId)) {
            return;
        }

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                currency: player.session.currencyName,
                system: player.session.system,
                betTracks: {},
                betQueue: [],

                operatorId: player.session.operatorId,
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
