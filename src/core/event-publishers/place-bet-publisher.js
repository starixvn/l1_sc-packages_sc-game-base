import BasePublisher from "./base-event-publisher";

export default class PlaceBetPublisher extends BasePublisher {
    publishGameFailedBet(playerId, payload) {
        this.publishToUser(playerId, payload);
    }

    publishGeneralFailedBet(playerId, payload) {
        this.publishToUser(playerId, payload, "message");
    }

    publishSuccessBet(playerId, payload) {
        this.publishToUser(playerId, payload);
    }
}
