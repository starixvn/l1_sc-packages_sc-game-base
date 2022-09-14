import GameData from "../game-data";
import GameDefinition from "../game-definition";

export default class PlayGamePermissionValidator {
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
        return (
            this.isValidCurrency(userSession) &&
            this.isValidGroupCurrency(userSession) &&
            this.isOffered(userSession) &&
            !this.isSiteExcluded(userSession)
        );
    }

    isValidCurrency(userSession) {
        return this.gameData.currencies.some(
            (currency) =>
                userSession.currencyName.toUpperCase() === currency.name.toUpperCase() && currency.partnerId === userSession.operatorId
        );
    }

    isValidGroupCurrency(userSession) {
        return this.gameData.currencyGroups.some((group) => group._id.toString() === userSession.currencyGroupId);
    }

    isOffered(userSession) {
        return this.gameData.currencyGroupGames.some((x) => x.groupId.toString() === userSession.currencyGroupId);
    }

    isSiteExcluded(userSession) {
        const gameSiteExclusion = this.gameData.partnerGameSiteExclusions.find((config) => config.partnerId === userSession.operatorId);

        const excludeSiteConfig = gameSiteExclusion?.value[this.definition.id];

        if(!excludeSiteConfig){
            return false;
        }

        return excludeSiteConfig.some((site) => site?.toLowerCase() === userSession.siteName.toLowerCase());
    }
}
