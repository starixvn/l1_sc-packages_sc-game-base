import SettleGameRoundConsumer from "../../core/event-consumers/settle-game-round-consumer";

export default class TableSettleGameRoundConsumer extends SettleGameRoundConsumer {
    async settleBets({ result, settlementResult, roundId, time }) {
        const realPlayerBets = await this.gameDefinition.betRepository.find({ phien: roundId }).exec();
        const botBets = await this.gameDefinition.tempBetRepository.find({ phien: roundId }).exec();
        const allBets = realPlayerBets.concat(botBets);

        if (allBets && allBets.length) {
            const { odds } = this.gameData.gameConfigs;

            await Promise.all(
                allBets.map(async (bet) => {
                    const betResult = this.calculateBetResult(settlementResult, bet, odds);

                    bet.betwin = betResult.totalWin;
                    bet.thanhtoan = true;

                    await bet.save();
                    await this.callEndGame(bet, roundId, time, betResult);
                    this.notifyBetResult(bet, betResult);
                })
            );
        }
        this.roundResultPublisher.publishRoundResult({ result, settlementResult, roundId, winningPlayers: this.gameData.winningPlayers });
    }

    notifyBetResult(bet, betResult) {
        if (betResult.totalWin > 0 && this.gameData.players[bet.uid]) {
            this.gameData.players[bet.uid].red += betResult.totalWin;
        }

        super.notifyBetResult(bet, betResult);
    }
}
