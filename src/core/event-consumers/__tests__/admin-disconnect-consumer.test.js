import AdminDisconnectConsumer from "../admin-disconnect-consumer";
import GameData from "../../game-data";

jest.useFakeTimers();

describe("consume test", () => {
    test("delete real players in Game Data - gameData.realPlayers should be empty", () => {
        const socketId = 123;
        const gameData = new GameData();
        gameData.admins = {
            [socketId]: {},
        };

        const consumer = new AdminDisconnectConsumer(gameData);
        consumer.consume({ id: socketId });
        jest.runAllTimers();
        expect(setTimeout).toHaveBeenCalled();
        expect(gameData.admins[socketId]).toBeUndefined();
    });
});
