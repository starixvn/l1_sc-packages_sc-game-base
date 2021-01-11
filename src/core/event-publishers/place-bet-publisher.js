import BaseEventPublisher from "./base-event-publisher";

export default class PlaceBetPublisher extends BaseEventPublisher {
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
