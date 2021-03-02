import BaseEventPublisher from "./base-event-publisher";

export default class AdminPublisher extends BaseEventPublisher {
    publishToAdmin(socketClient, payload) {
        socketClient.emit("message", { [this.gameName]: payload });
    }

    publishUnauthorizedMessage(socketClient) {
        socketClient.emit("message", { unauth: { message: "Authentication failed!" } });
    }

    publishAuthorizedMessage(socketClient) {
        socketClient.emit("message", { authorized: true });
    }
}
