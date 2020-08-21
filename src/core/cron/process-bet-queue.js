import { placeBet as placeBetApi } from "sc-base-apis";
import { helpers, logger } from "sc-common";

import { PlaceBetConsumer } from "./../event-consumers";
import { BasePublisher } from "./../event-publishers";

export default class ProcessBetQueue {
    processTimeOut = 50;

    /**
     * @param {PlaceBetConsumer} placeBetConsumer
     * @param {BasePublisher} publisher
     */

    constructor(definition, gameData, publisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher ?? new BasePublisher(definition.name, gameData);
    }

    start() {
        const keepDequeuingBets = () => {
            this.dequeueBets();
            setTimeout(keepDequeuingBets, this.processTimeOut);
        };

        setTimeout(keepDequeuingBets, this.processTimeOut);
    }

    dequeueBets() {
        if (this.gameData.ingame) {
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;
                    this.proceedBet(player, payload)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(logger.logError);
                }
            });
        }
    }

    async proceedBet(player, payload) {
        const betInfo = {
            cuoc: payload.amount,
            gameId: this.definition.id,
            gameRoundId: this.gameData.roundId,
            choiceId: this.definition.choicesMapper[payload.betChoice],
            freeBet: payload.freeBet,
        };

        const apiResult = await placeBetApi({ id: player.UID, session: player.session }, betInfo);

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, apiResult.response.red, payload);
        } else {
            const notice = apiResult.response.inSufficientBalance ? helpers.noticeHelper.notEnoughMoney : apiResult.response;

            await this.handleFailedBet(player, payload.betChoice, payload.amount, notice);
        }
    }

    async handleSuccessBet(player, red, bet) {
        const existingBetFilter = { uid: player.UID, phien: this.gameData.roundId, freeBet: bet.freeBet };
        const existingBet = await this.definition.betRepository.findOne(existingBetFilter).exec();

        if (this.definition.betLogRepository) {
            await this.insertBetLog(this.definition.betLogRepository, player, this.gameData.roundId, bet);
        }

        if (existingBet) {
            existingBet[bet.betChoice] += bet.amount;
            await existingBet.save();
        } else {
            const configs = this.gameData.gameConfigs;
            const newBet = {
                uid: player.UID,
                name: player.profile.name,
                phien: this.gameData.roundId,
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

        this.adjustBetTracks(player.profile.name, bet.betChoice, bet.amount);
        this.notifyPlacingBetResult(player, red, bet);
    }

    handleFailedBet(player, betChoice, betAmount, notice) {
        this.adjustBetTracks(player.profile.name, betChoice, -betAmount);

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

    adjustBetTracks(playerName, betChoice, amount) {
        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[betChoice] += amount;
        }
    }

    notifyPlacingBetResult(player, red, bet) {
        const result = this.generatePlacingBetResult(player, red, bet);
        this.publisher.publishToUser(player.UID, result);
    }

    generatePlacingBetResult(player, userBalance, bet) {
        this.gameData.totalBets[bet.betChoice] += bet.amount;

        if (this.gameData.chips) {
            this.gameData.chips[bet.betChoice][amount] += 1;
        }

        if (this.gameData.players[player.UID]) {
            this.gameData.players[player.UID].red = userBalance;
        }

        const betTracks = this.gameData.ingame[player.profile.name];
        const ownBets = this.definition.choices.reduce((result, choice) => {
            result[choice] = betTracks[bet.choice];
            return result;
        }, {});

        const successMessage = this.gameData.chips
            ? {
                  ownChip: { box: bet.betChoice, bet: bet.amount },
                  ownBets: ownBets,
                  endBet: bet.amount,
                  freeBet: bet.freeBet,
                  user: { red: userBalance },
              }
            : {
                  totalBets: this.gameData.totalBets,
                  ownBets: ownBets,
                  endBet: bet.amount,
                  freeBet: bet.freeBet,
                  user: { red: userBalance },
              };

        return successMessage;
    }
}
