import mongoose from "mongoose";

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
    constructor(definition, gameData, userSignInPublisher, userInfosRepository, userSessionsRepository, playGamePermissionValidator) {
        super(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository, playGamePermissionValidator);

        this.definition = definition;
    }

    async consume(socketClient, payload) {
        if (payload?.system === Systems.Mobi) {
            return super.consume(socketClient, payload);
        }

        const configs = this.gameData.gameConfigs;
        const configuredlyDisabled = !configs || !configs.enabled;
        const disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;

        if (disabled) {
            this.userSignInPublisher.publishUmNotice(socketClient, this.gameData.umMessages);
            return false;
        }

        return super.consume(socketClient, payload);
    }

    handleSignInSuccess(socketClient, userInfo, userSession) {
        super.handleSignInSuccess(socketClient, userInfo, userSession);

        this.userSignInPublisher.publishToGameMessage(socketClient, this.definition.name);
    }
}
