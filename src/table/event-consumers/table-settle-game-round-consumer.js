import mongoose from "mongoose";
import { endGame as endGameApi } from "sc-base-apis";

import SettleGameRoundConsumer from "./../../core/event-consumers/settle-game-round-consumer";
import { RoundResultPublisher, UserBetResultPublisher } from "./../../core/event-publishers";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableSettleGameRoundConsumer extends SettleGameRoundConsumer {
    defaultWinningStatus = {
        win: true,
        bet: 0,
        winningByChoices: {},
    };

    /**
     * @param {Object} dependencies
     * @param {TableGameDefinition} dependencies.definition
     * @param {TableGameData} dependencies.gameData
     * @param {RoundResultPublisher} dependencies.roundResultPublisher
     * @param {UserBetResultPublisher} dependencies.userBetResultPublisher
     * @param {endGameApi} dependencies.endGame
     * @param {mongoose.Model} dependencies.roundRepository
     * @param {mongoose.Model} dependencies.betRepository
     * @param {mongoose.Model} dependencies.tempBetRepository
     */
    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundRepository,
        betRepository,
        tempBetRepository,
    }) {
        super({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundRepository,
            betRepository,
        });

        this.tempBetRepository = tempBetRepository;
    }

    async queryBets(roundId) {
        const realPlayerBets = await this.betRepository.find({ phien: roundId }).exec();
        const botBets = await this.tempBetRepository.find({ phien: roundId }).exec();

        return realPlayerBets.concat(botBets);
    }

    captureBetResult(uid, betResult) {
        if (betResult.totalWin > 0) {
            const existingWinningStatus = this.gameData.winningPlayers[uid] ?? this.defaultWinningStatus;
            const winningStatus = {
                win: true,
                bet: existingWinningStatus.bet + betResult.totalWin,
                winningByChoices: Object.assign({}, existingWinningStatus.winningByChoices, betResult.winningByChoices),
            };

            this.gameData.winningPlayers[uid] = winningStatus;

            if (this.gameData.players[uid]) {
                this.gameData.players[uid].red += betResult.totalWin;
            }
        }

        super.captureBetResult(uid, betResult);
    }

    collectRoundResult(result, settlementResult, roundId) {
        const roundResult = super.collectRoundResult(result, settlementResult, roundId);

        roundResult.winningPlayers = this.gameData.winningPlayers;

        return roundResult;
    }
}
