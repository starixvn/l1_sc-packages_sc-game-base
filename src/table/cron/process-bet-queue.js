import { Cron } from "./../../core";

export default class TableProcessBetQueue extends Cron.ProcessBetQueue {
    generatePlacingBetResult(player, userBalance, bet) {
        const { betChoice, amount } = bet;
        const betResult = super.generatePlacingBetResult(player, userBalance, bet);

        betResult.ownChip = { betChoice, bet: amount };

        if (this.gameData.chips) {
            this.gameData.chips[betChoice][amount] += 1;
        }

        return betResult;
    }
}
