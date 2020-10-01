import BaseEventPublisher from "./base-event-publisher";

export default class RunningRoundInfoPublisher extends BaseEventPublisher {
    publish(gameData) {
        this.publishToAllUsers({
            totalBets: gameData.totalBets,
        });

        const inGame = {};
        Object.values(gameData.ingame).forEach((user) => {
            const { name, betTracks } = user;

            inGame[user.name] = { name, betTracks };
        });

        this.publishToAllAdmins({ inGame });
    }
}
