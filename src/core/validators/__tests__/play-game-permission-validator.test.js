import PlayGamePermissionValidator from "../play-game-permission-validator";

describe("isSiteExcluded", () => {
    const definition = { id: 2 };
    const gameData = {
        partnerGameSiteExclusions: []
    };
    const userSignInPublisher = {};

    it("return false when no settings", () => {
        // arrange
        const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
        const userSession = {siteName: "lumi"};

        // act
        const value = validator.isSiteExcluded(userSession);

        // assert
        expect(value).toBe(false);
    });

    it("return false when game not contains exclusion config", () => {
        // arrange
        const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
        const userSession = {siteName: "lumi"};
        gameData.partnerGameSiteExclusions = [{
            partnerId: "2W",
            type: "game_site_exclusions",
            value: {
                "1": ["lumi"]
            }
        }];

        // act
        const value = validator.isSiteExcluded(userSession);

        // assert
        expect(value).toBe(false);
    });

    it("return true when game contains exclusion config", () => {
        // arrange
        const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
        const userSession = {siteName: "lumi", partnerId: "2W"};
        gameData.partnerGameSiteExclusions = [{
            partnerId: "2W",
            type: "game_site_exclusions",
            value: {
                "2": ["lumi"]
            }
        }];

        // act
        const value = validator.isSiteExcluded(userSession);

        // assert
        expect(value).toBe(true);
    });
});