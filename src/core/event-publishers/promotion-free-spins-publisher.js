import BaseEventPublisher from "./base-event-publisher";

export default class PromotionFreeSpinsPublisher extends BaseEventPublisher {
    publishEndPromotion(playerId, payload) {
        this.publishToUser(playerId, payload);
    }
}
