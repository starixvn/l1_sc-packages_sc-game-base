import BasePublisher from "./base-publisher";

export default class PlaceBetPublisher extends BasePublisher {
    publishGameFailedBet(playerId, payload) {
        this.publishToUser(playerId, payload);
    }

    publishGeneralFailedBet(playerId, payload) {
        this.publishToUser(playerId, payload, "message");
    }

    publishSuccessBet(playerId, payload) {}
}
