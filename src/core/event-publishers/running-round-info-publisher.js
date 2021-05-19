import BaseEventPublisher from "./base-event-publisher";

export default class RunningRoundInfoPublisher extends BaseEventPublisher {
    publish() {
        this.publishToAllUsers({ totalBets: this.gameData.totalBets });

        const inGame = {};

        Object.values(this.gameData.ingame).forEach((user) => {
            const { name, currency, betTracks, system } = user;

            inGame[user.name] = { name, currency, betTracks, system };
        });

        this.publishToAllAdmins({ inGame });
    }
}
