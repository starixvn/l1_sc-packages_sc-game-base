import { gameConfigs } from "sc-base-database";
import { helpers } from "sc-common";
import { UserSignInConsumer } from "../../core/event-consumers";
import { TableUserSignInPublisher } from "../event-publishers";
import TableGameDefinition from "../table-game-definition";

export default class TableUserSignInConsumer extends UserSignInConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableUserSignInPublisher} userSigninPublisher
     */
    constructor(definition, userSigninPublisher = null) {
        super(userSigninPublisher);

        this.userSigninPublisher = userSigninPublisher ?? new TableUserSignInPublisher();
        this.definition = definition;
    }

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
            this.userSigninPublisher.publishUmNotice(socketClient, notice);
        }
    }

    handleSignInSuccess(socketClient, gameData, user, userInfo, userSession) {
        super.handleSignInSuccess(socketClient, gameData, user, userInfo, userSession);

        this.userSigninPublisher.publishToGameMessage(socketClient, this.definition.name);
    }
}
