import noticeHelper from "sc-common/helpers/notice-helper";

export default class UserSignInPublisher {
    publishUnauthorizedMessage(socketClient) {
        socketClient.emit("message", { unauthorized: true });
    }

    publishNotPermittedToPlayMessage(socketClient, gameName) {
        socketClient.emit(gameName, { notPermittedToPlay: true, message: noticeHelper.notPermittedToPlay(gameName) });
    }
}
