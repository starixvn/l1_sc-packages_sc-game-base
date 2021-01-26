import PlaceBetPublisher from "../../../src/core/event-publishers/place-bet-publisher";
import GameData from "./../../../src/core/game-data";

describe("publishGameFailedBet test", () => {
    it("should call publishToUser to selected userid", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
        const publisher = new PlaceBetPublisher(gameName, gameData);
        publisher.publishToUser = jest.fn();
        const playerId = 1;
        const payload = { endBet: -1 };
        // act
        publisher.publishGameFailedBet(playerId, payload);
        // assert
        expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, payload);
    });
});

describe("publishSuccessBet test", () => {
    it("should call publishToUser to selected userid", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
        const publisher = new PlaceBetPublisher(gameName, gameData);
        publisher.publishToUser = jest.fn();
        const playerId = 1;
        const payload = { endBet: 100 };
        // act
        publisher.publishSuccessBet(playerId, payload);
        // assert
        expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, payload);
    });
});

describe("publishGeneralFailedBet test", () => {
    it("should call publishToUser to selected userid", () => {
        // arrange
        const gameData = new GameData();
        const gameName = "game";
        const publisher = new PlaceBetPublisher(gameName, gameData);
        publisher.publishToUser = jest.fn();
        const playerId = 1;
        const payload = { endBet: 100 };
        // act
        publisher.publishGeneralFailedBet(playerId, payload);
        // assert
        expect(publisher.publishToUser).toHaveBeenCalledWith(playerId, payload, "message");
    });
});
