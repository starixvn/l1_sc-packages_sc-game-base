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
        return isValidCurrency(userSession) && isValidGroupCurrency(userSession) && isOffered(userSession) && !isSiteExcluded(userSession);
    }

    isValidCurrency(userSession) {
        return this.gameData.currencies.some((currency) => userSession.currencyName === currency.name);
    }

    isValidGroupCurrency(userSession) {
        return this.gameData.currencyGroups.some((group) => group._id.toString() === userSession.currencyGroupId);
    }

    isOffered(userSession) {
        return this.gameData.currencyGroupGames.some((x) => x.groupId.toString() === userSession.currencyGroupId);
    }

    isSiteExcluded(userSession) {
        const gameSiteExclusion = this.gameData.partnerGameSiteExclusions.find((config) => config.partnerId == userSession.partnerId);

        return gameSiteExclusion?.value?.[this.definition.id] && gameSiteExclusion.value[this.definition.id].includes(userSession.siteName);
    }
}
