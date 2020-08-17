import { BaseUserSignInConsumer } from "../../core/event-consumers";

export default class TableUserSignInConsumer extends BaseUserSignInConsumer {
    handleSignInSuccess(gameData, socketClient, userSession, userInfo) {
        super.handleSignInSuccess(gameData, userSession, userInfo);

        socketClient.emit("message", { toGame: this.gameName });
    }
}
