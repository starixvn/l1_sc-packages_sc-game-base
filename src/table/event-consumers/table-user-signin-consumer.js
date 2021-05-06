import mongoose from "mongoose";
import { helpers } from "sc-common";

import { Systems } from "../../constants";
import UserSignInConsumer from "./../../core/event-consumers/user-signin-consumer";
import TableUserSignInPublisher from "./../event-publishers/table-user-signin-publisher";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableUserSignInConsumer extends UserSignInConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {TableUserSignInPublisher} userSignInPublisher
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} userSessionsRepository
     */
    constructor(definition, gameData, userSignInPublisher, userInfosRepository, userSessionsRepository) {
        super(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository);

        this.definition = definition;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, payload) {
        if (payload.system === Systems.Mobi) {
            await super.consume(socketClient, payload);
            return;
        }

        const configs = this.gameData.gameConfigs;
        const configuredlyDisabled = !configs || !configs.enabled;
        const disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;

        if (!disabled) {
            await super.consume(socketClient, payload);
        } else {
            const umMessage = configs?.disabled_message ?? "";
            const notice = { title: helpers.noticeHelper.notice, text: umMessage, load: false };

            this.userSignInPublisher.publishUmNotice(socketClient, notice);
        }
    }

    handleSignInSuccess(socketClient, userInfo, userSession) {
        super.handleSignInSuccess(socketClient, userInfo, userSession);

        this.userSignInPublisher.publishToGameMessage(socketClient, this.definition.name);
    }
}
