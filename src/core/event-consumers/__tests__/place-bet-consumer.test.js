import GameData from "../../game-data";
import PlaceBetConsumer from "../place-bet-consumer";
import BaseEventPublisher from "../../event-publishers/base-event-publisher";
import GameDefinition from "../../game-definition";

jest.mock("../../event-publishers/base-event-publisher");

describe("adjustBetTracks test", () => {
    it("should update bet choice's amount in bet tracks", () => {
        const playerName = "nhanvat01";
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = new GameData();
        gameData.ingame = {
            [playerName]: {
                betTracks: {
                    choice01: 100,
                },
            },
        };

        const placeBetConsumer = new PlaceBetConsumer({}, gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.adjustBetTracks(playerName, payload);
        expect(gameData.ingame[playerName].betTracks.choice01).toEqual(200);
    });
});

describe("consume test", () => {
    it("valid bet, no inGame data, should init inGame Data then push to betQueue", () => {
        const playerName = "nhanvat01";
        const player = {
            profile: {
                name: playerName,
            },
            session: {
                currency: "US",
            },
        };
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = new GameData();
        gameData.ingame = {};

        const placeBetConsumer = new PlaceBetConsumer({}, gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => true);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).not.toBeEmpty();
        expect(gameData.ingame[playerName].betQueue).toHaveLength(1);
    });

    it("valid bet, have inGame data, should push to betQueue", () => {
        const playerName = "nhanvat01";
        const player = {
            profile: {
                name: playerName,
            },
            session: {
                currency: "US",
            },
        };
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = new GameData();
        gameData.ingame = {
            [playerName]: {
                name: player.profile.name,
                betTracks: {},
                betQueue: [],
            },
        };

        const placeBetConsumer = new PlaceBetConsumer({}, gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => true);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).not.toBeEmpty();
        expect(gameData.ingame[playerName].betQueue).toHaveLength(1);
        expect(gameData.ingame[playerName].betQueue[0]).toEqual({ player, payload });
    });

    it("invalid bet, have inGame data, should return", () => {
        const playerName = "nhanvat01";
        const player = {
            profile: {
                name: playerName,
            },
            session: {
                currency: "US",
            },
        };
        const payload = {
            amount: 100,
            betChoice: "choice01",
        };
        const gameData = new GameData();
        gameData.ingame = {
            [playerName]: {
                name: player.profile.name,
                betTracks: {},
                betQueue: [],
            },
        };

        const placeBetConsumer = new PlaceBetConsumer({}, gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => false);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).toBeEmpty();
    });
});

describe("validateBetRequest tests", () => {
    const playerName = "nhanvat01";
    const player = {
        UID: "123",
        profile: {
            name: playerName,
        },
        session: {
            currency: "US",
        },
    };

    const gameData = new GameData();
    gameData.ingame = {
        [playerName]: {
            name: player.profile.name,
            betTracks: {},
            betQueue: [],
        },
    };

    it("have failed criteron, publish to user and return false", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer({}, gameData, publisher);
        placeBetConsumer.composeValidationCriteria = jest.fn(() => [{ failure: true, notice: "" }]);

        var actualResult = placeBetConsumer.validateBetRequest(player, "betChoice", 1, false);

        expect(publisher.publishToUser).toHaveBeenCalled();
        expect(actualResult).toBeFalse();
    });

    it("invalid bet amount and choice, return false", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer({}, gameData, publisher);
        var actualResult = placeBetConsumer.validateBetRequest(player, null, null, false);

        expect(publisher.publishToUser).not.toHaveBeenCalled();
        expect(actualResult).toBeFalse();
    });

    it("valid bet request, return true", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer({}, gameData, publisher);
        placeBetConsumer.composeValidationCriteria = jest.fn(() => [{ failure: false, notice: "" }]);

        var actualResult = placeBetConsumer.validateBetRequest(player, "betChoice", 1, false);

        expect(actualResult).toBeTrue();
    });
});

describe("composeValidationCriteria tests", () => {
    const playerName = "nhanvat01";
    const player = {
        UID: "123",
        profile: {
            name: playerName,
            minBet: 1,
            maxBet: 500,
        },
        session: {
            currency: "US",
        },
    };

    const gameData = new GameData();
    gameData.ingame = {
        [playerName]: {
            name: player.profile.name,
            betTracks: {},
            betQueue: [],
        },
    };
    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        choices_maxbet: {
            "choice01": 200
        }
    };

    const gameDefinition = new GameDefinition({
        choices: ["choice01"],
        durations: {
            placingBets: 30,
            lockingBet: 5,
        },
    });

    it("return criterons", () => {
        const publisher = new BaseEventPublisher("", gameData);
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);

        var actualResult = placeBetConsumer.composeValidationCriteria(player, "betChoice", 1, false);
        expect(actualResult).not.toBeEmpty();
    });
});
