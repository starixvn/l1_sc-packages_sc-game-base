import GameData from "../../game-data";
import RoundResultPublisher from "../round-result-publisher";

describe("publishRoundResult test", () => {
    it("should publish to all users & admins", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";

        const publisher = new RoundResultPublisher(gameName, gameData);
        publisher.publishToAllAdmins = jest.fn();
        publisher.publishToAllUsers = jest.fn();
        // act
        publisher.publishRoundResult({ red1: true, red2: false });
        // assert
        expect(publisher.publishToAllAdmins).toHaveBeenCalled();
        expect(publisher.publishToAllUsers).toHaveBeenCalled();
    });
});
