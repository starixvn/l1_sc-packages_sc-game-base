import GameManagementApiClientFactory from "../../game-management-api";
import { authenticationHelpers } from "../../helpers";
describe("Able to get data", () => {
    xit("Response data should not be NULL", async () => {
        // Arrange
        const appConfigs = {
            gameManagementApiSettings: {
                BASE: "https://l1-proxy.lumigame.com/game-management-service",
            },
            authenticateSettings: {
                url: "https://auth.lumigame.com/",
                id: "admin-api",
                secret: "adminapi@20luminet&",
                requestTimeout: 10000,
                useAuthenticate: false,
                audiences: ["api", "admin-api", "game-services"],
            },
        };
        const configName = "xocxoc";
        await authenticationHelpers.init(appConfigs.authenticateSettings);
        const apiClient = new GameManagementApiClientFactory(appConfigs).instance();

        // Act
        const config = await apiClient.gameConfigs.getGameConfigs("xocxoc");

        // Assert
        expect(config).not.toBeNull();
        expect(config.data.gameId).toBeGreaterThan(0);
        expect(config.data.name).toBe(configName);
    });
});
