import { logger } from "sc-common";
import GameData from "../../game-data";
import UserBetResultPublisher from "../user-bet-result-publisher";

jest.mock("../../helpers/authentication-helpers", () => ({
    init: jest.fn(),
    post: jest.fn(),
}));

jest.mock("sc-common", () => ({
    logger: {
        logError: jest.fn(),
    },
}));

const gameData = new GameData();
const gameName = "game";

const initPublisher = function () {
    return new UserBetResultPublisher(gameName, gameData, logger);
};

describe("publish test", () => {
    it("should publish to user", async () => {
        // arrange
        const publisher = initPublisher();
        publisher.publishToUser = jest.fn();
        // act
        await publisher.publish(1, { totalWin: 200 });
        // assert
        expect(publisher.publishToUser).toHaveBeenCalled();
    });
});

describe("publishToUser test", () => {
    describe("when found user", () => {
        it("should call publish to user", async () => {
            // arrange
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
            const publisher = initPublisher();
            // act
            await publisher.publishToUser(1, {});
            // assert
            expect(gameData.realPlayers[1].socketClient.emit).toHaveBeenCalled();
        });
    });

    afterEach(() => {
        gameData.realPlayers = {};
    });
});
