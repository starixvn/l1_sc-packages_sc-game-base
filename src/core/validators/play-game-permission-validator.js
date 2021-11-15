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
        const playPermission = this.isHavePlayingPermission(userSession);

        if (!playPermission) {
            this.userSignInPublisher.publishNotPermittedToPlayMessage(socketClient, this.definition.id);
            return false;
        }

        return true;
    }

    isHavePlayingPermission(userSession) {
        const isOffered = this.gameData.currencyGroupGames.some((x) => x.groupId.toString() === userSession.currencyGroupId);
        const gameSiteExclusion = this.gameData.partnerGameSiteExclusions.find((config) => config.partnerId == userSession.partnerId);
        const isExcluded =
            gameSiteExclusion?.value?.[this.definition.id] && gameSiteExclusion.value[this.definition.id].includes(userSession.siteName);

        return isOffered && !isExcluded;
    }
}
