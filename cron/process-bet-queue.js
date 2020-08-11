import { PlaceBetConsumer } from '../event-consumers/index.js';

export default class ProcessBetQueue {
    processTimeOut = 50;

    /**
     * @param {PlaceBetConsumer} placeBetConsumer
     */
    constructor(placeBetConsumer) {
        this.placeBetConsumer = placeBetConsumer ?? new PlaceBetConsumer();
    }

    async start(storage) {
        setTimeout(async () => {
            await proceedQueue(storage);
            setTimeout(proceed, this.processTimeOut);
        }, this.processTimeOut);
    }

    async proceedQueue(storage) {
        if (storage) {
            Object.values(storage.gameData.usersData).forEach(async (userInGame) => {
                if (!userInGame.betProcessing && userInGame.betQueue && userInGame.betQueue.length > 0) {
                    const { user, payload, gameData, userData } = userInGame.betQueue.shift();

                    userInGame.betProcessing = true;
                    await this.placeBetConsumer.proceedBet(user, payload, gameData, userData);
                    userInGame.betProcessing = false;
                }
            });
        }
    }
}
