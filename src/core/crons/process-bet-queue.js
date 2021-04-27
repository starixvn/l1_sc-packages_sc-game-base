import mongoose from "mongoose";
import { helpers, logger } from "sc-common";

import { PlaceBetPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class ProcessBetQueue {
    processTimeOut = 50;

    /**
     * @param {Object} dependencies
     * @param {GameDefinition} dependencies.definition
     * @param {GameData} dependencies.gameData
     * @param {PlaceBetPublisher} dependencies.placeBetPublisher
     * @param {*} dependencies.placeBet
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.betsRepository
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {mongoose.Model} dependencies.userInfosRepository
     */
    constructor({ definition, gameData, placeBetPublisher, placeBet, logService, betsRepository, betLogsRepository, userInfosRepository }) {
        this.definition = definition;
        this.gameData = gameData;
        this.placeBetPublisher = placeBetPublisher;
        this.placeBet = placeBet;
        this.logService = logService;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.userInfosRepository = userInfosRepository;
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
                        .catch(this.logService.logError);
                }
            });
        }
    }

    async proceedBet(player, payload) {
        const betInfo = this.formatApiBetInfo(payload);
        const apiResult = await this.placeBet({ id: player.UID, session: player.session }, betInfo);
        const { response } = apiResult;

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, response, betInfo.gameRoundId, payload);

            if (!payload.freeBet && (player.profile.minBet !== response.minBet || player.profile.maxBet !== response.maxBet)) {
                await this.updateUserStakeLevel(player, response.minBet, response.maxBet);
            }
        } else {
            const insufficientNotice = payload.freeBet ? helpers.noticeHelper.notEnoughScoin : helpers.noticeHelper.notEnoughMoney;
            const notice = response.inSufficientBalance ? insufficientNotice : response;

            this.handleFailedBet(player, notice, payload);

            if (
                (player.profile.minBet !== response.apiError?.minBet || player.profile.maxBet !== response.apiError?.maxBet) &&
                response.apiError?.minBet > 0 &&
                response.apiError?.maxBet > 0
            ) {
                await this.updateUserStakeLevel(player, response.apiError.minBet, response.apiError.maxBet);
            }
        }
    }

    async updateUserStakeLevel(player, minBet, maxBet) {
        await this.userInfosRepository.updateOne({ id: player.UID }, { minBet, maxBet, betLimitModifiedDate: new Date() });
        player.profile.minBet = minBet;
        player.profile.maxBet = maxBet;

        const userStakeLevel = { minBet, maxBet };
        this.placeBetPublisher.publishToUser(player.UID, { userStakeLevel }, this.definition.name);
    }

    formatApiBetInfo(payload) {
        return {
            amount: payload.amount,
            gameId: this.definition.id,
            gameRoundId: this.gameData.roundId,
            choiceId: this.definition.choicesMapper[payload.betChoice],
            freeBet: payload.freeBet,
        };
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        if (this.betLogsRepository) {
            await this.insertBetLog(player, roundId, bet);
        }

        await this.upsertBet(player, roundId, bet);

        this.adjustTotalBets(player, bet);
        this.notifyPlacingBetResult(player, balance, bet);
    }

    handleFailedBet(player, notice, bet) {
        const { betChoice } = bet;
        this.decreaseBetTracks(player.profile.name, bet);

        if (notice.apiError) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, kickedOut: notice.kickedOut });
        } else {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, notice });
        }
    }

    async upsertBet(player, roundId, bet) {
        const configs = this.gameData.gameConfigs;
        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            phien: roundId,
            time: new Date(),
            odds: configs.odds,
            freeBet: bet.freeBet,
        };
        const existingBetFilter = { uid: player.UID, phien: roundId, freeBet: bet.freeBet };
        const existingBetIncrement = {
            [bet.betChoice]: bet.amount,
            totalAmount: bet.amount,
        };

        if (player.session) {
            newBet.memberId = player.session.memberId;
            newBet.siteId = player.session.siteId;
        }

        await this.betsRepository.updateOne(
            existingBetFilter,
            { $inc: existingBetIncrement, $setOnInsert: newBet },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    async insertBetLog(player, roundId, bet) {
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

        await this.betLogsRepository.create(newBetLog);
    }

    decreaseBetTracks(playerName, bet) {
        const { betChoice, amount } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[betChoice] -= amount;
        }
    }

    adjustTotalBets(player, bet) {
        const { betChoice, amount } = bet;

        this.gameData.totalBets[betChoice] = (this.gameData.totalBets[betChoice] ?? 0) + amount;
    }

    notifyPlacingBetResult(player, balance, bet) {
        const result = this.generatePlacingBetResult(player, balance, bet);

        this.placeBetPublisher.publishSuccessBet(player.UID, result);
    }

    generatePlacingBetResult(player, balance, bet) {
        const { amount, freeBet, betChoice } = bet;
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };

        return {
            ownBets: betTracks,
            endBet: amount,
            betChoice,
            freeBet,
            user: { ...balance },
        };
    }
}
