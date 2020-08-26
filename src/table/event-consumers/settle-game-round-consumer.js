import SettleGameRoundConsumer from "../../core/event-consumers/settle-game-round-consumer";

export default class TableSettleGameRoundConsumer extends SettleGameRoundConsumer {
    async queryBets(roundId) {
        const realPlayerBets = await this.gameDefinition.betRepository.find({ phien: roundId }).exec();
        const botBets = await this.gameDefinition.tempBetRepository.find({ phien: roundId }).exec();

        return realPlayerBets.concat(botBets);
    }

    captureBetResult(uid, betResult) {
        if (betResult.totalWin > 0) {
            this.gameData.winningPlayers[uid] = status;

            if (this.gameData.players[uid]) {
                this.gameData.players[uid].red += betResult.totalWin;
            }
        }

        super.captureBetResult(uid, betResult);
    }

    collectRoundResult(result, settlementResult, roundId) {
        const roundResult = super.collectRound(result, settlementResult, roundId);

        roundResult.winningPlayers = this.gameData.winningPlayers;

        return roundResult;
    }
}
