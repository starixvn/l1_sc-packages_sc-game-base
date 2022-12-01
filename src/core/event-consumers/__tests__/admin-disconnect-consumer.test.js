import AdminDisconnectConsumer from "../admin-disconnect-consumer";
import GameData from "../../game-data";

jest.useFakeTimers();

describe("consume test", () => {
    describe("when delete real players in Game Data", () => {
        it("should call setTimeout", () => {
            // Arrange
            const socketId = 123;
            const gameData = new GameData();
            gameData.admins = {
                [socketId]: {},
            };
            jest.spyOn(global, "setTimeout");
            const consumer = new AdminDisconnectConsumer(gameData);

            // Act
            consumer.consume({ id: socketId });
            jest.runAllTimers();

            // Assert
            expect(setTimeout).toHaveBeenCalled();
        });
        it("admins[socketId] should be undefined", () => {
            // Arrange
            const socketId = 123;
            const gameData = new GameData();
            gameData.admins = {
                [socketId]: {},
            };

            const consumer = new AdminDisconnectConsumer(gameData);

            // Act
            consumer.consume({ id: socketId });
            jest.runAllTimers();

            // Assert
            expect(gameData.admins[socketId]).toBeUndefined();
        });
    });
});
