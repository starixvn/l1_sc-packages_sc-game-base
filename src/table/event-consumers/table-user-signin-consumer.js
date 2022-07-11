import { Socket } from "socket.io";
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
     * @param {Object} appConfigs
     * @param {mongoose.Model} userInfosRepository
     * @param {logger} logService
     */
    constructor(definition, gameData, userSignInPublisher, playGamePermissionValidator, appConfigs, userInfosRepository, logService) {
        super(gameData, userSignInPublisher, playGamePermissionValidator, appConfigs, userInfosRepository, logService);

        this.definition = definition;
    }

    /**
     * @param {Socket} socketClient
     */
    async consume(socketClient, payload) {
        if (payload?.system === Systems.Mobi) {
            await super.consume(socketClient, payload);
            return;
        }

        const configs = this.gameData.gameConfigs;
        const configuredlyDisabled = !configs || !configs.enabled;
        const disabled = configuredlyDisabled || this.gameData.delayStartTime > 0;

        if (!disabled) {
            await super.consume(socketClient, payload);
        } else {
            this.userSignInPublisher.publishUmNotice(socketClient, this.gameData.umMessages);
        }
    }

    handleSignInSuccess(socketClient, userInfo, userSession) {
        super.handleSignInSuccess(socketClient, userInfo, userSession);

        this.userSignInPublisher.publishToGameMessage(socketClient, this.definition.name);
    }
}
