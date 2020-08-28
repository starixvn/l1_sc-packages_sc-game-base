import { Cron } from "./../../core";
import { TablePlaceBetPublisher } from "./../event-publishers";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableProcessBetQueue extends Cron.ProcessBetQueue {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {TablePlaceBetPublisher} publisher
     */
    constructor(definition, gameData, publisher = null) {
        super(definition, gameData, publisher ?? new TablePlaceBetPublisher(definition.name, gameData));
    }

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
