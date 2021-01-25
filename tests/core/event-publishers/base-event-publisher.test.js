import BaseEventPublisher from "../../../src/core/event-publishers/base-event-publisher";
import GameData from "./../../../src/core/game-data";

describe("publishToAllUsers test", () => {
    it("should call emit for all socket clients", () => {
        // arrange
        const socketId = 1;
        const gameData = new GameData();
        const gameName = "game";
        gameData.realPlayers = {
            [socketId]: {
                socketClient: {
                    emit: jest.fn(),
                },
            },
        };

        const publisher = new BaseEventPublisher(gameName, gameData);
        // act
        const payload = { bet: 1 };
        publisher.publishToAllUsers(payload);
        // assert
        expect(gameData.realPlayers[socketId].socketClient.emit).toHaveBeenCalledWith(gameName, payload);
    });
});

describe("publishToAllUsersExcept test", () => {
    it("should not call emit for selected user", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
        gameData.realPlayers = {
            1: {
                UID: 1,
                socketClient: {
                    emit: jest.fn(),
                },
            },
            2: {
                UID: 2,
                socketClient: {
                    emit: jest.fn(),
                },
            },
        };

        const publisher = new BaseEventPublisher(gameName, gameData);
        // act
        const payload = { bet: 1 };
        publisher.publishToAllUsersExcept(1, payload);
        // assert
        expect(gameData.realPlayers[1].socketClient.emit).not.toHaveBeenCalled();
        expect(gameData.realPlayers[2].socketClient.emit).toHaveBeenCalledWith(gameName, payload);
    });
});

describe("publishToUser test", () => {
    it("should call emit for selected user", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
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

        const publisher = new BaseEventPublisher(gameName, gameData);
        // act
        const payload = { bet: 1 };
        publisher.publishToUser(1, payload);
        // assert
        expect(gameData.realPlayers[2].socketClient.emit).not.toHaveBeenCalled();
        expect(gameData.realPlayers[1].socketClient.emit).toHaveBeenCalledWith(gameName, payload);
    });

    it("should not call emit when socketClient isnt connected", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
        gameData.realPlayers = {
            1: {
                UID: 1,
                socketClient: {
                    connected: false,
                    emit: jest.fn(),
                },
            },

        };

        const publisher = new BaseEventPublisher(gameName, gameData);
        // act
        const payload = { bet: 1 };
        publisher.publishToUser(1, payload);
        // assert
        expect(gameData.realPlayers[1].socketClient.emit).not.toHaveBeenCalled();
    });
});

describe("publishToAllAdmins test", () => {
    it("should call emit for all admins", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
        gameData.admins = {
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

        const publisher = new BaseEventPublisher(gameName, gameData);
        // act
        const payload = { bet: 1 };
        publisher.publishToAllAdmins(1, payload);
        // assert
        expect(gameData.admins[1].socketClient.emit).toHaveBeenCalled();
        expect(gameData.admins[2].socketClient.emit).toHaveBeenCalled();
    });
});
