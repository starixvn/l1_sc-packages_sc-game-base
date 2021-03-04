import { logger } from "sc-common";
import GameData from "../../game-data";
import UserBetResultPublisher from "../user-bet-result-publisher";
import authenticationHelpers from "../../helpers/authentication-helpers";

jest.mock("../../helpers/authentication-helpers", () => ({
    init: jest.fn(),
    post: jest.fn(),
}));

jest.mock("sc-common", () => ({
    logger: {
        logError: jest.fn(),
    },
}));

describe("publish test", () => {
    it("should publish to user", async () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";

        const publisher = new UserBetResultPublisher(gameName, gameData, authenticationHelpers);
        publisher.publishToUser = jest.fn();
        // act
        await publisher.publish(1, { totalWin: 200 });
        // assert
        expect(publisher.publishToUser).toHaveBeenCalled();
    });

    it("should publish to all users & admins", async () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";

        const publisher = new UserBetResultPublisher(gameName, gameData);
        publisher.publishToUser = jest.fn();
        // act
        await publisher.publish(1, { totalWin: 0 });
        // assert
        expect(publisher.publishToUser).toHaveBeenCalled();
    });
});

describe("publishToUser test", () => {
    it("found user - should call publish to user", async () => {
        // arrange
        const gameData = new GameData();
        gameData.realPlayers = {
            1: {
                UID: 1,
                socketClient: {
                    connected: true,
                    emit: jest.fn(),
                },
            },
            2: {
                UID: 2,
                socketClient: {
                    connected: true,
                    emit: jest.fn(),
                },
            },
        };

        const gameName = "game";
        const publisher = new UserBetResultPublisher(gameName, gameData, authenticationHelpers, logger);
        // act
        await publisher.publishToUser(1, {});
        // assert
        expect(gameData.realPlayers[1].socketClient.emit).toHaveBeenCalled();
    });

    it("not found user - should call refreshBalance", async () => {
        // arrange
        const gameData = new GameData();
        gameData.realPlayers = {
            1: {
                UID: 1,
                socketClient: {
                    connected: true,
                    emit: jest.fn(),
                },
            },
            2: {
                UID: 2,
                socketClient: {
                    connected: true,
                    emit: jest.fn(),
                },
            },
        };

        const gameName = "game";
        const publisher = new UserBetResultPublisher(gameName, gameData, authenticationHelpers, logger);
        jest.spyOn(publisher, "refreshBalance");
        // act
        await publisher.publishToUser(3, {});
        // assert
        expect(publisher.refreshBalance).toHaveBeenCalled();
    });
});

describe("refreshBalance test", () => {
    it("mainServiceCommunicator throw exception - should log the error", async () => {
        // arrange
        const gameData = new GameData();
        gameData.realPlayers = {
            1: {
                UID: 1,
                socketClient: {
                    connected: true,
                    emit: jest.fn(),
                },
            },
            2: {
                UID: 2,
                socketClient: {
                    connected: true,
                    emit: jest.fn(),
                },
            },
        };

        const gameName = "game";
        const publisher = new UserBetResultPublisher(gameName, gameData, authenticationHelpers, logger);
        authenticationHelpers.post.mockImplementation(() => {
            throw new TypeError();
        });
        // act
        await publisher.refreshBalance(3);
        // assert
        expect(logger.logError).toHaveBeenCalled();
    });
});
