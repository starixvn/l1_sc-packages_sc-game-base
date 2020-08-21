import BasePublisher from "./base-publisher";

export default class PlaceBetPublisher extends BasePublisher {
    publishGameFailedBet(userId, payload) {
        this.publishToUser(userId, payload);
    }

    publishGeneralFailedBet(userId, payload) {
        this.publishToUser(userId, payload, "message");
    }

    publishSuccessBet(payload) {
        this.publishToAllUsers(payload);
    }
}
