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

    start(storage) {
        let self = this;

        setTimeout(function proceed() {
            if (storage) {
                Object.values(storage.gameData.usersData).forEach((userInGame) => {
                    if (!userInGame.betProcessing && userInGame.betQueue && userInGame.betQueue.length > 0) {
                        const { user, payload } = userInGame.betQueue.shift();

                        userInGame.betProcessing = true;
                        self.placeBetConsumer
                            .proceedBet(user, payload, userInGame)
                            .then(() => (userInGame.betProcessing = false))
                            .catch(logger.logError);
                    }
                });
            }

            setTimeout(proceed, self.processTimeOut);
        }, this.processTimeOut);
    }
}
