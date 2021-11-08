import GameData from "../game-data";
import GameDefinition from "../game-definition";

export class PlayGamePermissionValidator {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     */
    constructor(definition, gameData, userSignInPublisher) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInPublisher = userSignInPublisher;
    }

    validate(userSession, socketClient) {
        const isExist = this.gameData.currencyGroupGames.some((x) => x.groupId.toString() === userSession.currencyGroupId);

        if (!isExist) {
            this.userSignInPublisher.publishNotPermittedToPlayMessage(socketClient, this.definition.id);
            return false;
        }

        return true;
    }
}
