import { placeBet as placeBetApi } from "sc-base-apis";
import { helpers, logger } from "sc-common";

import { PlaceBetPublisher } from "./../event-publishers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class ProcessBetQueue {
    processTimeOut = 50;

    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {PlaceBetPublisher} publisher
     */
    constructor(definition, gameData, publisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher ?? new PlaceBetPublisher(definition.name, gameData);
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
            amount: payload.amount,
            gameId: this.definition.id,
            gameRoundId: this.gameData.roundId,
            choiceId: this.definition.choicesMapper[payload.betChoice],
            freeBet: payload.freeBet,
        };
        const apiResult = await placeBetApi({ id: player.UID, session: player.session }, betInfo);

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, apiResult.response, betInfo.gameRoundId, payload);
        } else {
            const insufficientNotice = payload.freeBet ? helpers.noticeHelper.notEnoughScoin : helpers.noticeHelper.notEnoughMoney;
            const notice = apiResult.response.inSufficientBalance ? insufficientNotice : apiResult.response;

            this.handleFailedBet(player, notice);
        }
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        if (this.definition.betLogRepository) {
            await this.insertBetLog(this.definition.betLogRepository, player, roundId, bet);
        }

        await this.upsertBet(player, roundId, bet);

        this.adjustBetTracks(player.profile.name, bet);
        this.adjustTotalBets(player, bet);
        this.notifyPlacingBetResult(player, balance, bet);
    }

    handleFailedBet(player, notice) {
        if (notice.apiError) {
            this.publisher.publishGameFailedBet(player.UID, { endBet: -1, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.publisher.publishGameFailedBet(player.UID, { endBet: -1, kickedOut: notice.kickedOut });
        } else {
            this.publisher.publishGameFailedBet(player.UID, { endBet: -1, notice });
        }
    }

    async upsertBet(player, roundId, bet) {
        const existingBetFilter = { uid: player.UID, phien: roundId, freeBet: bet.freeBet };
        const existingBet = await this.definition.betRepository.findOne(existingBetFilter).exec();

        if (existingBet) {
            existingBet[bet.betChoice] += bet.amount;
            await existingBet.save();
        } else {
            const configs = this.gameData.gameConfigs;
            const newBet = {
                uid: player.UID,
                name: player.profile.name,
                phien: roundId,
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

    adjustBetTracks(playerName, bet) {
        const { betChoice, amount } = bet;

        if (this.gameData.ingame?.[playerName]) {
            const playerInGame = this.gameData.ingame[playerName];

            playerInGame.betTracks[betChoice] = (playerInGame.betTracks[betChoice] ?? 0) + amount;
        }
    }

    adjustTotalBets(player, bet) {
        const { betChoice, amount } = bet;

        this.gameData.totalBets[betChoice] = (this.gameData.totalBets[betChoice] ?? 0) + amount;
    }

    notifyPlacingBetResult(player, balance, bet) {
        const result = this.generatePlacingBetResult(player, balance, bet);

        this.publisher.publishSuccessBet(player.UID, result);
    }

    generatePlacingBetResult(player, balance, bet) {
        const { amount, freeBet } = bet;
        const { betTracks } = this.gameData.ingame[player.profile.name];

        return {
            ownBets: betTracks,
            endBet: amount,
            freeBet,
            user: { ...balance },
        };
    }
}
