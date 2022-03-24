import UserDisconnectConsumer from "../user-disconnect-consumer";
import GameData from "../../game-data";

jest.useFakeTimers();

describe("consume test", () => {
    describe("when delete real players in Game Data", () => {
        it("should call setTimeout", () => {
            const socketId = 123;
            const gameData = new GameData();
            gameData.realPlayers = {
                [socketId]: {},
            };

            const consumer = new UserDisconnectConsumer(gameData);
            consumer.consume({ id: 123 });
            jest.runAllTimers();
            expect(setTimeout).toHaveBeenCalled();
        });

        it(" gameData.realPlayers should be empty", () => {
            const socketId = 123;
            const gameData = new GameData();
            gameData.realPlayers = {
                [socketId]: {},
            };

            const consumer = new UserDisconnectConsumer(gameData);
            consumer.consume({ id: 123 });
            jest.runAllTimers();
            expect(Object.keys(gameData.realPlayers)).toHaveLength(0);
        });
    });
});
