import BaseEventPublisher from './base-publisher.js';

export default class ApiErrorPublisher extends BaseEventPublisher {
    publish(userId, apiError) {
        this.publishToUser(userId, apiError);
    }
}
