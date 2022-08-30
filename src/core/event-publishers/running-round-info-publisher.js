import BaseEventPublisher from "./base-event-publisher";

export default class RunningRoundInfoPublisher extends BaseEventPublisher {
    publish() {
        this.publishToAllUsers({ totalBets: this.gameData.totalBets });

        const inGame = {};

        Object.values(this.gameData.ingame).forEach((user) => {
            const { name, currency, ownBets, system, operatorId } = user;

            inGame[user.name] = { name, currency, betTracks: ownBets, system, partnerId: operatorId, operatorId };
        });

        this.publishToAllAdmins({ inGame });
    }
}
