import SettleGameRoundConsumer from "./../../core/event-consumers/settle-game-round-consumer";

export default class TableSettleGameRoundConsumer extends SettleGameRoundConsumer {
    defaultWinningStatus = {
        win: true,
        bet: 0,
        winningByChoices: {},
    };

    async queryBets(roundId) {
        const realPlayerBets = await this.definition.betRepository.find({ phien: roundId }).exec();
        const botBets = await this.definition.tempBetRepository.find({ phien: roundId }).exec();

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
