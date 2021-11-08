import GameData from "../game-data";

export class PlayGamePermissionValidator {
    /**
     * @param {GameData} gameData
     */
    constructor(gameData, userSignInPublisher) {
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
