import SettleGameRoundConsumer from "../../core/event-consumers/settle-game-round-consumer";

export default class TableSettleGameRoundConsumer extends SettleGameRoundConsumer {
    async settleBets(gameData, { result, settlementResult, roundId, time }) {
        const realPlayerBets = await this.gameDefinition.betLogRepository.find({ phien: roundId }).exec();
        const botBets = await this.gameDefinition.tempBetLogRepository.find({ phien: roundId }).exec();
        const allBets = realPlayerBets.concat(botBets);

        if (allBets && allBets.length) {
            const { odds } = gameData.gameConfigs;

            await Promise.all(
                allBets.map(async (bet) => {
                    const betResult = this.calculateBetResult(settlementResult, bet, odds);

                    bet.betwin = betResult.totalWin;
                    bet.thanhtoan = true;

                    await bet.save();
                    this.notifyBetResult(gameData, bet, betResult);
                    await this.callEndGame(bet, roundId, time, betResult);
                })
            );
        }
        this.roundResultPublisher.publishRoundResult({ result, settlementResult, roundId, winningPlayers: gameData.winningPlayers });
    }

    notifyBetResult(gameData, bet, betResult) {
        if (betResult.totalWin > 0 && gameData.players[bet.uid]) {
            gameData.players[bet.uid].red += betResult.totalWin;
            //updateBotBalance(bet.uid, gameData.usersAndBots[bet.uid].red);
        }

        //userBetResultPublisher.publish({ bet, betResult: status });
        // TODO: Update user coin
        //     if (status.win && void 0 !== self.io.users[bet.uid]) {
        //         self.io.users[bet.uid].forEach(function (client) {
        //             User.updateCoint(client);
        //         });
        //     }

        super.notifyBetResult(gameData, bet, betResult);
    }
}
