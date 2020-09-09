import BaseEventPublisher from "./base-event-publisher";

export default class RunningRoundInfoPublisher extends BaseEventPublisher {
    publish(gameData) {
        this.publishToAllUsers({
            totalBets: gameData.totalBets,
        });

        const { ...ingame } = gameData;
        for (const user in ingame) {
            delete user.betQueue;
        }

        this.publishToAllAdmins({ inGame: ingame });
    }
}
