import BaseEventPublisher from "./base-event-publisher";

export default class RunningRoundInfoPublisher extends BaseEventPublisher {
    publish(gameData) {
        this.publishToAllUsers({
            totalBets: gameData.totalBets,
        });

        this.publishToAllAdmins({
            inGame: {
                name: gameData.ingame.name,
                betTracks: gameData.ingame.betTracks,
            },
        });
    }
}
