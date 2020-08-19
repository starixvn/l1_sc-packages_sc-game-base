import PlaceBetConsumer from '../../core/event-consumers/place-bet-consumer.js';
import TableGameData from '../table-game-data.js';
import TableGameDefinition from '../table-game-definition.js';

export default class TablePlaceBetConsumer extends PlaceBetConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {BasePublisher} publisher
     * @param {TableGameData} gameData
     */

    constructor(placeBetPublisher, choiceMapper, gameData, definition) {
        super(placeBetPublisher, choiceMapper, gameData, definition);
    }
}
