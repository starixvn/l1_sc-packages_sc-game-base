import BaseEventPublisher from "./base-event-publisher";

export default class RunningRoundInfoPublisher extends BaseEventPublisher {
    publish() {
        this.publishToAllUsers({ totalBets: this.gameData.totalBets });

        const inGame = {};

        Object.values(this.gameData.ingame).forEach((user) => {
            const { name, currency, betTracks, system, partnerId, operatorId } = user;

            inGame[user.name] = { name, currency, betTracks, system, partnerId, operatorId };
        });

        this.publishToAllAdmins({ inGame });
    }
}
