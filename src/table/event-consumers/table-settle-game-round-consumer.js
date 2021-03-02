import mongoose from "mongoose";

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
     * @param {*} dependencies.endGame
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.betsRepository
     * @param {mongoose.Model} dependencies.tempBetsRepository
     */
    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundsRepository,
        betsRepository,
        tempBetsRepository,
    }) {
        super({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });

        this.tempBetsRepository = tempBetsRepository;
    }

    async queryBets(roundId) {
        const realPlayerBets = await this.betsRepository.find({ phien: roundId }).exec();
        const botBets = await this.tempBetsRepository.find({ phien: roundId }).exec();

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
