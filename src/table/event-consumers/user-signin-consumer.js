import { BaseUserSignInConsumer } from "../../core/event-consumers";
import { gameConfigs } from "sc-base-database";
import { helpers } from "sc-common";

export default class TableUserSignInConsumer extends BaseUserSignInConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, gameData, payload) {
        const configs = await gameConfigs.findOne({ name: this.definition.configName });
        gameData.gameConfigs = configs;

        if (configs && configs.enabled) {
            await super.consume(socketClient, gameData, payload);
        } else {
            let umMessage = helpers.noticeHelper.underMaintenance;

            if (!!configs && !!configs.disabled_message) {
                umMessage = configs.disabled_message;
            }

            const notice = { title: helpers.noticeHelper.noticeTitle, text: umMessage, load: false };
            socketClient.emit("message", { notice: notice, um: true });
        }
    }

    handleSignInSuccess(socketClient, gameData, user, userInfo, userSession) {
        super.handleSignInSuccess(socketClient, gameData, user, userInfo, userSession);

        socketClient.emit("message", { toGame: this.definition.name });
    }
}
