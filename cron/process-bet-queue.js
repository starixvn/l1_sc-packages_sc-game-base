import { logger } from 'sc-common';
import { PlaceBetConsumer } from '../event-consumers/index.js';

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
                        const { user, payload, gameData } = userInGame.betQueue.shift();
                        userInGame.betProcessing = true;
                        self.placeBetConsumer
                            .proceedBet(user, payload, gameData, userInGame)
                            .then(() => {
                                userInGame.betProcessing = false;
                            })
                            .catch((error) => {
                                logger.logError(error);
                            });
                    }
                });
            }

            setTimeout(proceed, self.processTimeOut);
        }, this.processTimeOut);
    }
}
