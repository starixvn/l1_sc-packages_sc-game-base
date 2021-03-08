export default class UserSignInPublisher {
    publishUnauthorizedMessage(socketClient) {
        socketClient.emit("message", { unauthorized: true });
    }

    publishNotPermittedToPlayMessage(socketClient, gameId) {
        socketClient.emit("message", { notPermittedToPlay: true, gameId });
    }
}
