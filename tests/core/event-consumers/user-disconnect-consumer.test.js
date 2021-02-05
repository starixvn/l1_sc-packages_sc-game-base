import UserDisconnectConsumer from "./../../../src/core/event-consumers/user-disconnect-consumer";
import GameData from "./../../../src/core/game-data";

jest.useFakeTimers();

describe("consume test", () => {
    test("delete real players in Game Data - gameData.realPlayers should be empty", () => {
        const socketId = 123;
        const gameData = new GameData();
        gameData.realPlayers = {
            [socketId]: {},
        };

        const consumer = new UserDisconnectConsumer(gameData);
        consumer.consume({ id: 123 });
        jest.runAllTimers();
        expect(setTimeout).toHaveBeenCalled();
        expect(Object.keys(gameData.realPlayers)).toHaveLength(0);
    });
});
