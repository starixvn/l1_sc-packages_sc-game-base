import { placeBet as placeBetApi } from "sc-base-apis";
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

    constructor(definition, gameData, placeBetPublisher = null) {
        this.placeBetPublisher = placeBetPublisher ?? new BasePublisher(gameData, definition.name);
        this.definition = definition;
    }

    validateBetRequest(gameData, player, betChoice, amount) {
        if (!amount || !betChoice) {
            return false;
        }

        const gameName = this.definition.name;
        const configs = gameData.gameConfigs;
        const { betTracks } = gameData.ingame[player.profile.name] || { betTracks: {} };
        const totalAmount = this.definition.choices.reduce((total, choice) => total + (betTracks[choice] || 0), 0) + amount;
        const maxBetPerChoice = configs.choices_maxbet[betChoice] || 0;

        const defaultCriteria = [
            {
                failure:
                    gameData.remainingTime < this.definition.durations.lockingBet ||
                    gameData.remainingTime >= this.definition.durations.placingBets,
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
            this.placeBetPublisher.publishGameFailedBet(player.UID, { [gameName]: { notice: failedCriterion.notice } });

            return false;
        }

        return true;
    }

    async placeBet(player, payload, gameData) {
        const amount = payload.amount >> 0;
        const betChoice = payload.betChoice;

        if (!this.validateBetRequest(gameData, player, betChoice, amount)) {
            return;
        }

        const name = player.profile.name;

        if (!gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                betTracks: {},
            };

            newPlayer.betQueue = [];
            gameData.ingame[name] = newPlayer;
        }

        gameData.ingame[name].betQueue.push({ player, payload });
    }

    async proceedBet(player, gameData, payload) {
        const betInfo = {
            cuoc: payload.amount,
            gameId: this.definition.id,
            gameRoundId: gameData.roundId,
            choiceId: this.definition.choicesMapper[payload.betChoice],
            freeBet: payload.freeBet,
        };

        const apiResult = await placeBetApi({ id: player.UID, session: player.session }, betInfo);

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, gameData, apiResult.response.red, payload);
        } else {
            const notice = apiResult.response.inSufficientBalance ? helpers.noticeHelper.notEnoughMoney : apiResult.response;

            await this.handleFailedBet(player, gameData, payload.betChoice, payload.amount, notice);
        }
    }

    async handleSuccessBet(player, gameData, red, bet) {
        const existingBetFilter = { uid: player.UID, phien: gameData.roundId, freeBet: bet.freeBet };
        const existingBet = await this.definition.betRepository.findOne(existingBetFilter).exec();

        if (this.definition.betLogRepository) {
            await this.insertBetLog(this.definition.betLogRepository, player, gameData.roundId, bet);
        }

        if (existingBet) {
            existingBet[bet.betChoice] += bet.amount;
            await existingBet.save();
        } else {
            const configs = gameData.gameConfigs;
            const newBet = {
                uid: player.UID,
                name: player.profile.name,
                phien: gameData.roundId,
                time: new Date(),
                odds: configs.odds,
                freeBet: bet.freeBet,
            };
            const existingBetIncrement = { [bet.betChoice]: bet.amount };

            if (player.session) {
                newBet.memberId = player.session.memberId;
                newBet.siteId = player.session.siteId;
            }

            await this.definition.betRepository.updateOne(
                existingBetFilter,
                { $inc: existingBetIncrement, $setOnInsert: newBet },
                { upsert: true, setDefaultsOnInsert: true }
            );
        }

        this.adjustBetTracks(gameData, player.profile.name, bet.betChoice, bet.amount);
        this.notifyPlacingBetResult(player, gameData, red, bet);
    }

    handleFailedBet(player, gameData, betChoice, betAmount, notice) {
        this.adjustBetTracks(gameData, player.profile.name, betChoice, -betAmount);

        if (notice.apiError) {
            placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, kickedOut: notice.kickedOut });
        } else {
            placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, notice });
        }
    }

    async insertBetLog(betLogRepository, player, roundId, bet) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            phien: roundId,
            time: new Date(),
            choice: bet.betChoice,
            amount: bet.amount,
            freeBet: bet.freeBet,
        };

        if (player.session) {
            newBetLog.memberId = player.session.memberId;
            newBetLog.siteId = player.session.siteId;
        }

        await betLogRepository.create(newBetLog);
    }

    adjustBetTracks(gameData, playerName, betChoice, amount) {
        if (gameData.ingame && gameData.ingame[playerName]) {
            const playerInGame = gameData.ingame[playerName];

            playerInGame.betTracks[betChoice] += amount;
        }
    }

    notifyPlacingBetResult(player, gameData, red, bet) {
        const result = this.generatePlacingBetResult(gameData, player, red, bet);
        this.placeBetPublisher.publishSuccessBet(result);
    }

    generatePlacingBetResult(gameData, player, userBalance, bet) {
        gameData.totalBets[bet.betChoice] += bet.amount;

        if (gameData.chips) {
            gameData.chips[bet.betChoice][amount] += 1;
        }

        if (gameData.players[player.UID]) {
            gameData.players[player.UID].red = userBalance;
        }

        const betTracks = gameData.ingame[player.profile.name];
        const ownBets = constants.choices.reduce((result, choice) => {
            result[choice] = betTracks[bet.choice];
            return result;
        }, {});

        const successMessage = gameData.chips
            ? {
                  [this.definition.name]: {
                      ownChip: { box: bet.betChoice, bet: bet.amount },
                      ownBets: ownBets,
                      endBet: bet.amount,
                      freeBet: bet.freeBet,
                  },
                  user: { red: userBalance },
              }
            : {
                  [this.definition.name]: { totalBets: gameData.totalBets, ownBets: ownBets, endBet: bet.amount, freeBet: bet.freeBet },
                  user: { red: userBalance },
              };

        return successMessage;
    }
}
