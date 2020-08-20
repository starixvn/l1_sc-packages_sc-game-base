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
                    this.notifyBetResult(bet, betResult);
                    await this.callEndGame(bet, roundId, time, betResult);
                })
            );
        }
        this.roundResultPublisher.publishRoundResult({ result, settlementResult, roundId, winningPlayers: this.gameData.winningPlayers });
    }

    notifyBetResult(bet, betResult) {
        if (betResult.totalWin > 0 && this.gameData.players[bet.uid]) {
            this.gameData.players[bet.uid].red += betResult.totalWin;
            //updateBotBalance(bet.uid, gameData.usersAndBots[bet.uid].red);
        }

        //userBetResultPublisher.publish({ bet, betResult: status });
        // TODO: Update user coin
        //     if (status.win && void 0 !== self.io.users[bet.uid]) {
        //         self.io.users[bet.uid].forEach(function (client) {
        //             User.updateCoint(client);
        //         });
        //     }

        super.notifyBetResult(bet, betResult);
    }
}
