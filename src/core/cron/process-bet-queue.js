import { logger } from "sc-common";
import { placeBet as placeBetApi } from "sc-base-apis";

import { PlaceBetConsumer } from "./../event-consumers";
import { BasePublisher } from "./../event-publishers";

export default class ProcessBetQueue {
    processTimeOut = 50;

    /**
     * @param {PlaceBetConsumer} placeBetConsumer
     * @param {BasePublisher} publisher
     */

    constructor(definition, gameData, publisher = null) {
        this.publisher = publisher ?? new BasePublisher(gameData, definition.name);
    }

    start(gameData) {
        const keepDequeuingBets = () => {
            this.dequeueBets(gameData);
            setTimeout(keepDequeuingBets, this.processTimeOut);
        };

        setTimeout(keepDequeuingBets, this.processTimeOut);
    }

    dequeueBets(gameData) {
        if (gameData.ingame) {
            Object.values(gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;
                    this.proceedBet(player, gameData, payload)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(logger.logError);
                }
            });
        }
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
            this.publisher.publishToUser(player.UID, { endBet: -1, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.publisher.publishToUser(player.UID, { endBet: -1, kickedOut: notice.kickedOut });
        } else {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice });
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
        this.publisher.publishToUser(player.UID, result);
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
