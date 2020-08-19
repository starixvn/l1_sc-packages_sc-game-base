import { logger } from "sc-common";
import { PlaceBetConsumer } from "./../event-consumers";

export default class ProcessBetQueue {
    processTimeOut = 50;

    /**
     * @param {PlaceBetConsumer} placeBetConsumer
     */
    constructor(placeBetConsumer) {
        this.placeBetConsumer = placeBetConsumer ?? new PlaceBetConsumer();
    }

    dequeueBets(gameData) {
        if (gameData.ingame) {
            Object.values(gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;
                    this.placeBetConsumer
                        .proceedBet(player, gameData, payload)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(logger.logError);
                }
            });
        }
    }

    start(gameData) {
        const keepDequeuingBets = () => {
            this.dequeueBets(gameData);
            setTimeout(keepDequeuingBets, this.processTimeOut);
        };

        setTimeout(keepDequeuingBets, this.processTimeOut);
    }
}
