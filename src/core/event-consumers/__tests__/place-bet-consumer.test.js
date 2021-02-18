import GameData from "../../game-data";
import PlaceBetConsumer from "../place-bet-consumer";
import BaseEventPublisher from "../../event-publishers/base-event-publisher";

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
                currency: "US"
            }
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
                currency: "US"
            }
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
            }
        };

        const placeBetConsumer = new PlaceBetConsumer({}, gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => true);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).not.toBeEmpty();
        expect(gameData.ingame[playerName].betQueue).toHaveLength(1);
        expect(gameData.ingame[playerName].betQueue[0]).toEqual({player, payload});
    });

    it("invalid bet, have inGame data, should return", () => {
        const playerName = "nhanvat01";
        const player = {
            profile: {
                name: playerName,
            },
            session: {
                currency: "US"
            }
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
            }
        };

        const placeBetConsumer = new PlaceBetConsumer({}, gameData, new BaseEventPublisher("", {}));
        placeBetConsumer.validateBetRequest = jest.fn(() => false);
        placeBetConsumer.consume(player, payload);

        expect(gameData.ingame[playerName].betQueue).toBeEmpty();
    });
});
