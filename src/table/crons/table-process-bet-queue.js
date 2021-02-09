import ProcessBetQueue from "./../../core/crons/process-bet-queue";

export default class TableProcessBetQueue extends ProcessBetQueue {
    generatePlacingBetResult(player, balance, bet) {
        const { betChoice, amount } = bet;
        const ownBet = super.generatePlacingBetResult(player, balance, bet);

        ownBet.ownChip = { betChoice, amount };

        if (this.gameData.chips) {
            this.gameData.chips[betChoice] = this.gameData.chips[betChoice] ?? {};
            this.gameData.chips[betChoice][amount] = (this.gameData.chips[betChoice][amount] ?? 0) + 1;
        }

        if (this.gameData.players[player.UID]) {
            this.gameData.players[player.UID].red = balance.red;
        }

        return ownBet;
    }
}
