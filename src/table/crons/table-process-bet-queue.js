import ProcessBetQueue from "./../../core/crons/process-bet-queue";

export default class TableProcessBetQueue extends ProcessBetQueue {
    generatePlacingBetResult(player, balance, bet, rate) {
        const { betChoice, amount } = bet;
        const ownBet = super.generatePlacingBetResult(player, balance, bet, rate);

        ownBet.ownChip = { betChoice, amount };

        this.updateGameDataChips(bet, rate);

        if (this.gameData.players[player.UID]) {
            this.gameData.players[player.UID].red = balance.red;
        }

        return ownBet;
    }

    updateGameDataChips(bet, rate) {
        const { betChoice, amount } = bet;

        if (!this.gameData.chips[rate]) {
            this.gameData.chips[rate] = { [betChoice]: { amount: 1 } };
        } else {
            this.gameData.chips[rate][betChoice] = this.gameData.chips[rate][betChoice] ?? {};
            this.gameData.chips[rate][betChoice][amount] = (this.gameData.chips[rate][betChoice][amount] ?? 0) + 1;
        }
    }
}
