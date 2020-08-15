import BaseGameCron from "../../core/cron/game-cron.js";
import TableGameDefinition from "../table-game-definition.js";

export default class TableGameCron extends BaseGameCron {
    /**
     * @param {TableGameDefinition} gameDefinition
     */
    constructor(gameDefinition) {
        super(gameDefinition);
    }

    async settleBets(gameData, { result, settlementResult, roundId, time }) {
        const realPlayerBets = await this.gameDefinition.betLogRepository.find({ phien: roundId }).exec();
        const botBets = await this.gameDefinition.tempBetLogRepository.find({ phien: roundId }).exec();
        const allBets = realPlayerBets.concat(botBets);

        if (allBets && allBets.length) {
            const { odds } = gameData.gameConfigs;

            await Promise.all(
                allBets.map(async (bet) => {
                    const betResult = this.calculateBetResult(finish, bet, odds);

                    bet.betwin = betResult.totalWin;
                    bet.thanhtoan = true;

                    await bet.save();
                    this.notifyBetResult(gameData, bet, betResult);
                    await this.callEndGame(bet, roundId, time, betResult);
                })
            );
        }
    }
}
