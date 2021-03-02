import AdminPublisher from "../admin-publisher";
import GameData from "../../game-data";

describe("publishToAdmin test", () => {
    it("should call emit", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
        const socketClient = {
            emit: jest.fn(),
        };

        const publisher = new AdminPublisher(gameName, gameData);
        // act
        const payload = { bet: 1 };
        publisher.publishToAdmin(socketClient, payload);
        // assert
        expect(socketClient.emit).toHaveBeenCalledWith("message", { [gameName]: payload });
    });
});
