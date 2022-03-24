import PlayGamePermissionValidator from "../play-game-permission-validator";

describe("isSiteExcluded", () => {
    const definition = { id: 2 };
    const gameData = {
        partnerGameSiteExclusions: [],
    };
    const userSignInPublisher = {};

    describe("when no settings", () => {
        it("should return false", () => {
            // arrange
            const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
            const userSession = { siteName: "lumi" };

            // act
            const value = validator.isSiteExcluded(userSession);

            // assert
            expect(value).toBe(false);
        });
    });

    describe("when game not contains exclusion config", () => {
        it("should return false", () => {
            // arrange
            const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
            const userSession = { siteName: "lumi" };
            gameData.partnerGameSiteExclusions = [
                {
                    partnerId: "2W",
                    type: "game_site_exclusions",
                    value: {
                        1: ["lumi"],
                    },
                },
            ];

            // act
            const value = validator.isSiteExcluded(userSession);

            // assert
            expect(value).toBe(false);
        });
    });

    describe("when game contains exclusion config", () => {
        it("should return true", () => {
            // arrange
            const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
            const userSession = { siteName: "lumi", partnerId: "2W" };
            gameData.partnerGameSiteExclusions = [
                {
                    partnerId: "2W",
                    type: "game_site_exclusions",
                    value: {
                        2: ["lumi"],
                    },
                },
            ];

            // act
            const value = validator.isSiteExcluded(userSession);

            // assert
            expect(value).toBe(true);
        });
    });

    describe("when game contains exclusion config but value is null", () => {
        it("should return false", () => {
            // arrange
            const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
            const userSession = { siteName: "lumi", partnerId: "2W" };
            gameData.partnerGameSiteExclusions = [
                {
                    partnerId: "2W",
                    type: "game_site_exclusions",
                    value: {
                        2: [null],
                    },
                },
            ];

            // act
            const value = validator.isSiteExcluded(userSession);

            // assert
            expect(value).toBe(false);
        });
    });

    describe("when game contains exclusion config but not same value", () => {
        it("should return false", () => {
            // arrange
            const validator = new PlayGamePermissionValidator(definition, gameData, userSignInPublisher);
            const userSession = { siteName: "lumi", partnerId: "2W" };
            gameData.partnerGameSiteExclusions = [
                {
                    partnerId: "2W",
                    type: "game_site_exclusions",
                    value: {
                        2: ["lumi2"],
                    },
                },
            ];

            // act
            const value = validator.isSiteExcluded(userSession);

            // assert
            expect(value).toBe(false);
        });
    });
});
