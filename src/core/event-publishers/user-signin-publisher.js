export default class UserSignInPublisher {
    publishUnauthorizedMessage(socketClient) {
        socketClient.emit("message", { unauthorized: true });
    }

    publishRecheckInSuccessMesasge(socketClient) {
        socketClient.emit("message", { recheckinSuccess: true });
    }
}
