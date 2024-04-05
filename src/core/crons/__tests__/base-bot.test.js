import GameData from "../../game-data";
import GameDefinition from "../../game-definition";

import GameManagementApiClientFactory from "../../game-management-api";
import BaseBot from "../base-bot";

const mockGetTotalBots = jest.fn();

jest.mock("sc-game-management-client");

const gameData = new GameData(3);
const definition = new GameDefinition({ id: 1, name: "game name", durations: { lockingBet: 2 } });

const gameManagementApiClientFactory = new GameManagementApiClientFactory({});

const initBot = function () {
    return new BaseBot(definition, gameData, gameManagementApiClientFactory);
};

afterEach(() => {
    jest.clearAllMocks();
});

describe("reset tests", () => {
    describe("when botenabled is false", () => {
        it("should call removeAllBots", async () => {
            // Arrange
            gameData.gameConfigs = { botenabled: false };

            const baseBot = initBot();
            jest.spyOn(baseBot, "removeAllBots");

            // Act
            await baseBot.reset();

            // Assert
            expect(baseBot.removeAllBots).toHaveBeenCalled();
        });
    });

    describe("when botenabled is true", () => {
        it("should call processDisabledBots", async () => {
            // Arrange
            gameData.gameConfigs = { botenabled: true, maxbot: 0.5 };
            const baseBot = initBot();
            baseBot.gameManagementApiClient.users.getTotalBots.mockReturnValueOnce({ isSuccessful: true, data: 100 });
            baseBot.gameManagementApiClient.users.getAllBots.mockReturnValueOnce({ isSuccessful: true, data: [] });
            jest.spyOn(baseBot, "processDisabledBots");

            // Act
            await baseBot.reset();

            // Assert
            expect(baseBot.processDisabledBots).toHaveBeenCalled();
        });

        it("should calculate maxNumberOfBots", async () => {
            // Arrange
            gameData.gameConfigs = { botenabled: true, maxbot: 0.5 };

            const baseBot = initBot();
            baseBot.gameManagementApiClient.users.getTotalBots.mockReturnValueOnce({ isSuccessful: true, data: 100 });
            baseBot.gameManagementApiClient.users.getAllBots.mockReturnValueOnce({ isSuccessful: true, data: [] });
            jest.spyOn(baseBot, "processDisabledBots");

            // Acct
            await baseBot.reset();

            // Assert
            expect(baseBot.maxNumberOfBots).toEqual(100 * 0.5);
        });
    });
});

describe("run tests", () => {
    describe("when after placing bet", () => {
        it("should add bot to indicesOfBotsToBeRemoved", async () => {
            gameData.gameConfigs = { botenabled: true };
            const bots = [
                { id: 1, name: "bot1", type: true, red: 2000 },
                { id: 2, name: "bot2", type: true, red: 2000 },
                { id: 3, name: "bot3", type: true, red: 2000 },
                { id: 4, name: "bot4", type: true, red: 2000 },
                { id: 5, name: "bot5", type: true, red: 2000 },
                { id: 6, name: "bot6", type: true, red: 2000 },
            ];

            const baseBot = initBot();
            baseBot.bots = bots;
            jest.spyOn(baseBot, "placeBet");

            await baseBot.run();

            expect(baseBot.placeBet).toHaveBeenCalled();
        });
    });
});
