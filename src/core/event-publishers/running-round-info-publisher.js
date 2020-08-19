import BaseEventPublisher from "./base-publisher";

export default class RunningRoundInfoPublisher extends BaseEventPublisher {
    publish(gameData) {
        this.publishToAllUsers({
            totalBets: gameData.totalBets,
        });

        this.publishToAllAdmins({
            inGame: gameData.usersData,
        });
    }
}
