import { BaseUserSignInConsumer } from "../../core/event-consumers";
import { gameConfigs } from "sc-base-database";
import { helpers } from "sc-common";

export default class TableUserSignInConsumer extends BaseUserSignInConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(gameData, socketClient, payload) {
        const configs = await gameConfigs.findOne({ name: this.definition.configName });
        gameData.gameConfigs = configs;

        if (configs && configs.enabled) {
            await super.consume(gameData, socketClient, storage, payload);
        } else {
            let umMessage = helpers.noticeHelper.underMaintenance;

            if (!!configs && !!configs.disabled_message) {
                umMessage = configs.disabled_message;
            }

            const notice = { title: helpers.noticeHelper.noticeTitle, text: umMessage, load: false };
            socketClient.emit("message", { notice: notice, um: true });
        }
    }

    handleSignInSuccess(gameData, socketClient, userSession, userInfo) {
        super.handleSignInSuccess(gameData, userSession, userInfo);

        socketClient.emit("message", { toGame: this.definition.name });
    }
}
