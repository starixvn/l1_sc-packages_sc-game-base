import GameData from "../../game-data";
import RunningRoundInfoPublisher from "../running-round-info-publisher";

describe("publishRoundResult test", () => {
    it("should publish to all users", () => {
        // arrange
        const gameData = new GameData();
        gameData.ingame = {
            player01: {
                name: "player01",
            },
            currency: "US",
            betTracks: {},
        };
        const gameName = "game";

        const publisher = new RunningRoundInfoPublisher(gameName, gameData);
        publisher.publishToAllAdmins = jest.fn();
        publisher.publishToAllUsers = jest.fn();
        // act
        publisher.publish();
        // assert
        expect(publisher.publishToAllUsers).toHaveBeenCalled();
    });

    it("should publish to all  admins", () => {
        // arrange
        const gameData = new GameData();
        gameData.ingame = {
            player01: {
                name: "player01",
            },
            currency: "US",
            betTracks: {},
        };
        const gameName = "game";

        const publisher = new RunningRoundInfoPublisher(gameName, gameData);
        publisher.publishToAllAdmins = jest.fn();
        publisher.publishToAllUsers = jest.fn();
        // act
        publisher.publish();
        // assert
        expect(publisher.publishToAllAdmins).toHaveBeenCalled();
    });
});
