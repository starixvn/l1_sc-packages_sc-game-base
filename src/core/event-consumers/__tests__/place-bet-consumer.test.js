import Chance from "chance";
import { helpers } from "sc-common";

import BaseEventPublisher from "../../event-publishers/base-event-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import PlaceBetConsumer from "../place-bet-consumer";

jest.mock("../../event-publishers/base-event-publisher");

describe("adjustBetTracks test", () => {
    it("should update bet choice's amount in bet tracks", () => {
        const playerName = "nhanvat01";
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = initGameData();
        gameData.ingame = {
            [playerName]: {
                betTracks: {
                    choice01: 100,
                },
            },
        };

        const placeBetConsumer = new PlaceBetConsumer(initGameDefinition(), gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.adjustBetTracks(playerName, payload);
        expect(gameData.ingame[playerName].betTracks.choice01).toEqual(200);
    });
});

describe("consume test", () => {
    it("valid bet, no inGame data, should init inGame Data then push to betQueue", () => {
        const playerName = "nhanvat01";
        const player = mockPlayer(playerName);
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = initGameData();
        gameData.ingame = {};

        const placeBetConsumer = new PlaceBetConsumer(initGameDefinition(), gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => true);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).not.toBeEmpty();
        expect(gameData.ingame[playerName].betQueue).toHaveLength(1);
    });

    it("valid bet, have inGame data, should push to betQueue", () => {
        const playerName = "nhanvat01";
        const player = mockPlayer(playerName);
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = initGameData();
        gameData.ingame = {
            [playerName]: {
                name: player.profile.name,
                betTracks: {},
                betQueue: [],
            },
        };

        const placeBetConsumer = new PlaceBetConsumer(initGameDefinition(), gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => true);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).not.toBeEmpty();
        expect(gameData.ingame[playerName].betQueue).toHaveLength(1);
        expect(gameData.ingame[playerName].betQueue[0]).toEqual({ player, payload });
    });

    it("invalid bet, have inGame data, should return", () => {
        const playerName = "nhanvat01";
        const player = mockPlayer(playerName);
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = initGameData();
        gameData.ingame = {
            [playerName]: {
                name: player.profile.name,
                betTracks: {},
                betQueue: [],
            },
        };

        const placeBetConsumer = new PlaceBetConsumer(initGameDefinition(), gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => false);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).toBeEmpty();
    });
});

describe("validateBetRequest tests", () => {
    const playerName = "nhanvat01";
    const player = mockPlayer(playerName);

    const gameData = initGameData();
    gameData.ingame = {
        [playerName]: {
            name: player.profile.name,
            betTracks: {},
            betQueue: [],
        },
    };

    const definition = initGameDefinition();

    it("have failed criteron, publish to user and return false", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer(definition, gameData, publisher);
        placeBetConsumer.composeValidationCriteria = jest.fn(() => [{ failure: true, notice: "" }]);

        var actualResult = placeBetConsumer.validateBetRequest(player, "betChoice", 1, false);

        expect(publisher.publishToUser).toHaveBeenCalled();
        expect(actualResult).toBeFalse();
    });

    it("invalid bet amount and choice, return false", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer(definition, gameData, publisher);
        var actualResult = placeBetConsumer.validateBetRequest(player, null, null, false);

        expect(publisher.publishToUser).not.toHaveBeenCalled();
        expect(actualResult).toBeFalse();
    });

    it("valid bet request, return true", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer(definition, gameData, publisher);
        placeBetConsumer.composeValidationCriteria = jest.fn(() => [{ failure: false, notice: "" }]);

        var actualResult = placeBetConsumer.validateBetRequest(player, "betChoice", 1, false);

        expect(actualResult).toBeTrue();
    });
});

describe("composeValidationCriteria tests", () => {
    const playerName = "nhanvat01";
    const player = mockPlayer(playerName);

    const gameData = initGameData();
    gameData.ingame = {
        [playerName]: {
            name: player.profile.name,
            betTracks: {},
            betQueue: [],
        },
    };
    gameData.remainingTime = 20;

    const gameDefinition = initGameDefinition();

    it("return criterons", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);

        var actualResult = placeBetConsumer.composeValidationCriteria(player, "betChoice", 1, false);
        expect(actualResult).not.toBeEmpty();
    });
});

describe("composeBettingTimeValidationCriteria tests", () => {
    const playerName = "nhanvat01";
    const player = mockPlayer(playerName);

    const gameDefinition = initGameDefinition();
    const gameData = initGameData();
    gameData.ingame = {
        [playerName]: {
            name: player.profile.name,
            betTracks: {},
            betQueue: [],
        },
    };

    beforeEach(() => {
        gameData.remainingTime = 10;
        gameData.roundId = 1;
        gameData.gameConfigs.enabled = true;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("return invalidBet notice if game was disabled", () => {
        // arrange
        const publisher = new BaseEventPublisher(gameDefinition.name, gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);
        gameData.gameConfigs.enabled = false;

        // act
        var actualResult = placeBetConsumer.composeBettingTimeValidationCriteria(gameData.roundId);

        // assert
        expect(actualResult.filter((x) => x.failure).length).toBe(1);
        expect(actualResult.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: helpers.noticeHelper.invalidBet },
        });
    });

    it("return invalidBet notice if round id is different with running round", () => {
        // arrange
        const betRoundId = 2;
        const publisher = new BaseEventPublisher(gameDefinition.name, gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);

        // act
        var actualResult = placeBetConsumer.composeBettingTimeValidationCriteria(betRoundId);

        // assert
        expect(actualResult.filter((x) => x.failure).length).toBe(1);
        expect(actualResult.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: helpers.noticeHelper.invalidBet, gameRoundId: betRoundId },
        });
    });

    it("return placeBetNextRound notice if bet comes in locking times", () => {
        // arrange
        const chance = new Chance();
        const publisher = new BaseEventPublisher(gameDefinition.name, gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);
        gameData.remainingTime = chance.integer({ min: 0, max: gameDefinition.durations.lockingBet - 1 });

        // act
        var actualResult = placeBetConsumer.composeBettingTimeValidationCriteria(gameData.roundId);

        // assert
        expect(actualResult.filter((x) => x.failure).length).toBe(1);
        expect(actualResult.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: helpers.noticeHelper.placeBetNextRound },
        });
    });

    it("return placeBetNextRound notice if bet comes later than place bet times", () => {
        // arrange
        const chance = new Chance();
        const publisher = new BaseEventPublisher(gameDefinition.name, gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);
        gameData.remainingTime = chance.integer({ min: gameDefinition.durations.placingBets, max: 100 });

        // act
        var actualResult = placeBetConsumer.composeBettingTimeValidationCriteria(gameData.roundId);

        // assert
        expect(actualResult.filter((x) => x.failure).length).toBe(1);
        expect(actualResult.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: helpers.noticeHelper.placeBetNextRound },
        });
    });
});

describe("composeHedgeBetValidationCriteria tests", () => {
    const playerName = "nhanvat01";
    const player = mockPlayer(playerName);

    const gameData = initGameData();
    gameData.ingame = {
        [playerName]: {
            name: player.profile.name,
            betTracks: {
                choice01: 30,
            },
            betQueue: [],
        },
    };
    gameData.remainingTime = 20;

    const gameDefinition = initGameDefinition();

    it("return no failure when NOT having another bet choice on same hedge group", () => {
        // Arrange
        const betChoice = "choice03";
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);

        // Act
        const actualResult = placeBetConsumer.composeHedgeBetValidationCriteria(betChoice, player);

        // Assert
        expect(actualResult.find((x) => x.failure)).toBe(undefined);
    });

    it("return failure when having another bet choice on same hedge bet group", () => {
        // Arrange
        const betChoice = "choice02";
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);

        // Act
        const actualResult = placeBetConsumer.composeHedgeBetValidationCriteria(betChoice, player);

        // Assert
        expect(actualResult.find((x) => x.failure)).toStrictEqual({
            failure: true,
            notice: { errorCode: helpers.noticeHelper.disallowHedgeBet, hedgeBetGroup: ["choice01", "choice02"] },
        });
    });
});

function mockPlayer(playerName) {
    return {
        UID: "123",
        profile: {
            name: playerName,
            minBet: 1,
            maxBet: 500,
        },
        session: {
            currency: "US",
            currencyGroupId: "1",
        },
    };
}

function initGameDefinition() {
    return new GameDefinition({
        id: 1,
        name: "game",
        choices: ["choice01", "choice02", "choice03"],
        hedgeBetGroups: [["choice01", "choice02"]],
        durations: {
            placingBets: 30,
            lockingBet: 5,
        },
    });
}

function initGameData() {
    const gameData = new GameData();
    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        choices_maxbet: {
            choice01: 200,
            choice02: 200,
            choice03: 200,
        },
    };
    gameData.currencyGroupGames = [
        {
            groupId: 1,
            minBet: 1,
            maxBet: 2000,
            maxBetPerChoices: [],
        },
    ];

    return gameData;
}
