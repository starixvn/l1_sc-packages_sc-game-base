import { Cron } from "../../core";
import { TablePlaceBetPublisher } from "../event-publishers";
import GameData from "../table-game-data";
import GameDefinition from "../table-game-definition";

export default class TableProcessBetQueue extends Cron.ProcessBetQueue {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {TablePlaceBetPublisher} publishe
     */
    constructor(definition, gameData, publisher = null) {
        super(definition, gameData, publisher ?? new TablePlaceBetPublisher(definition.name, gameData));
    }

    generatePlacingBetResult(player, red, bet) {
        const { betChoice, amount } = bet;
        const ownBet = super.generatePlacingBetResult(player, red, bet);

        ownBet.ownChip = { betChoice, amount };

        if (this.gameData.chips) {
            this.gameData.chips[betChoice] = this.gameData.chips[betChoice] ?? {};
            this.gameData.chips[betChoice][amount] = (this.gameData.chips[betChoice][amount] ?? 0) + 1;
        }

        if (this.gameData.players[player.UID]) {
            this.gameData.players[player.UID].red = red;
        }

        return ownBet;
    }
}
