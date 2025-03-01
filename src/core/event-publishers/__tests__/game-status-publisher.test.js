import GameData from "../../game-data";
import GameStatusPublisher from "../game-status-publisher";

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

gameData.remainingTime = 10;
gameData.roundId = 10;
gameData.gameConfigs = {
    minbet: 1,
    maxbet: 100,
    choices_maxbet: { big: 100, small: 100 },
    odds: { big: 2, small: 2 },
    enableFreeBet: false,
};

gameData.umMessages = { "en-US": "UM" };

describe("publishDisableGameStatus test", () => {
    describe("when gameData.disabledMessage is undefined", () => {
        it("should send to all users with empty string", () => {
            // arrange
            const publisher = new GameStatusPublisher(gameName, gameData);
            publisher.publishToAllUsers = jest.fn();

            // act
            publisher.publishDisableGameStatus();
            const payload = { um: true, um_message: gameData.umMessages };

            // assert
            expect(publisher.publishToAllUsers).toHaveBeenCalledWith(payload);
        });
    });

    describe("when gameData disabled_message has value", () => {
        it("should send to all users clients with disabled_message", () => {
            // arrange
            const publisher = new GameStatusPublisher(gameName, gameData);
            publisher.publishToAllUsers = jest.fn();

            // act
            publisher.publishDisableGameStatus();
            const payload = { um: true, um_message: gameData.umMessages };
            // assert
            expect(publisher.publishToAllUsers).toHaveBeenCalledWith(payload);
        });
    });
});

describe("publishStartGame test", () => {
    it("should call publishToAllUsers", () => {
        // arrange
        const publisher = new GameStatusPublisher(gameName, gameData);
        publisher.publishToAllUsers = jest.fn();

        // act
        publisher.publishStartGame();

        // assert
        expect(publisher.publishToAllUsers).toHaveBeenCalledWith({
            remainingTime: gameData.remainingTime,
            snr: true,
        });
    });
});
