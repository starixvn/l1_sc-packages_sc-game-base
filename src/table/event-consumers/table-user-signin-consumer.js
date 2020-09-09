import { helpers } from "sc-common";

import { UserSignInConsumer } from "./../../core/event-consumers";
import { TableUserSignInPublisher } from "./../event-publishers";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableUserSignInConsumer extends UserSignInConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {TableUserSignInPublisher} userSigninPublisher
     */
    constructor(definition, gameData, userSigninPublisher = null) {
        super(gameData, userSigninPublisher);

        this.definition = definition;
        this.userSigninPublisher = userSigninPublisher ?? new TableUserSignInPublisher();
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, payload) {
        const configs = this.gameData.gameConfigs;
        const configuredlyDisabled = !configs || !configs.enabled;
        const disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;

        if (!disabled) {
            await super.consume(socketClient, payload);
        } else {
            const umMessage = configs?.disabled_message ?? "";
            const notice = { title: helpers.noticeHelper.noticeTitle, text: umMessage, load: false };

            this.userSigninPublisher.publishUmNotice(socketClient, notice);
        }
    }

    handleSignInSuccess(socketClient, userInfo, userSession) {
        super.handleSignInSuccess(socketClient, userInfo, userSession);

        this.userSigninPublisher.publishToGameMessage(socketClient, this.definition.name);
    }
}
