import UserSignInPublisher from "./../../core/event-publishers/user-signin-publisher";

export default class TableUserSignInPublisher extends UserSignInPublisher {
    publishToGameMessage(socketClient, toGameName) {
        socketClient.emit("message", { toGame: toGameName });
    }

    publishUmNotice(socketClient, notice) {
        socketClient.emit("message", { notice: notice, um: true });
    }
}
