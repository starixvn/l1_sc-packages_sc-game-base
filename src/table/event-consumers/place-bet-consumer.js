import PlaceBetConsumer from "../../core/event-consumers/place-bet-consumer";
import TableGameData from "../table-game-data";
import TableGameDefinition from "../table-game-definition";

export default class TablePlaceBetConsumer extends PlaceBetConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {BasePublisher} publisher
     * @param {TableGameData} gameData
     */

    constructor(definition, gameData, placeBetPublisher = null) {
        super(definition, gameData, placeBetPublisher);
    }
}
