import BaseEventPublisher from "./base-publisher";

export default class ApiErrorPublisher extends BaseEventPublisher {
    publish(userId, apiError) {
        this.publishToUser(userId, apiError);
    }
}
