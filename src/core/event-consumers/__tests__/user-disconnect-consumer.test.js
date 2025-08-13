import UserDisconnectConsumer from "../user-disconnect-consumer";
import GameData from "../../game-data";

describe("UserDisconnectConsumer", () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });
    describe("when delete real players in Game Data", () => {
        it("should call setTimeout", () => {
            // Arrange
            const socketId = 123;
            const gameData = new GameData();
            gameData.realPlayers = {
                [socketId]: {},
            };
            const consumer = new UserDisconnectConsumer(gameData);
            spyOn(global, "setTimeout");

            // Act
            consumer.consume({ id: 123 });
            jest.runAllTimers();

            // Assert
            expect(setTimeout).toHaveBeenCalled();
        });

        it("gameData.realPlayers should be empty", () => {
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
