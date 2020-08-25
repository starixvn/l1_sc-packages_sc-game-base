export default class UserSignInPublisher {
    publishUnauthorizedMessage(socketClient) {
        socketClient.emit("message", { unauthorized: true });
    }
}
