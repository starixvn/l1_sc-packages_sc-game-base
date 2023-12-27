import BaseEventPublisher from "../../event-publishers/base-event-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import RoundQuery from "../../query-apis/round-query";
import InGameConsumer from "../in-game-consumer";
import GameManagementApiClientFactory from "../../game-management-api";

jest.mock("sc-game-management-client");
jest.mock("../../query-apis/round-query");
jest.mock("../../event-publishers/base-event-publisher");

describe("in-game-consumer tests", () => {
    const definition = new GameDefinition({ id: 1, name: "game name" });
    const gameData = new GameData(30);
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        choices_maxbet: {
            choice01: 200,
        },
        odds: {
            choice01: 2,
        },
        enableFreeBet: false,
    };
    gameData.exchangeRates = {
        exId: 1,
        code: {
            USD: 1,
            VND: 0.00004405,
            IDR: 0.07099,
        },
    };

    const roundQuery = new RoundQuery();
    const publisher = new BaseEventPublisher();
    const getBalance = jest.fn();
    const realPlayer = {
        socketClient: {
            emit: jest.fn(),
        },
        profile: {
            name: "player01",
        },
        session: {
            currencyGroupId: 1,
            currencyCode: "USD",
            multiplier: 1000,
        },
    };
    const gameManagementApiClientFactory = new GameManagementApiClientFactory({});
    let consumer;
    beforeEach(() => {
        consumer = new InGameConsumer(definition, gameData, roundQuery, publisher, getBalance, gameManagementApiClientFactory);
    });
    describe("consume test", () => {
        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should publish to user game configs", async () => {
            consumer.buildPayload = jest.fn(() => ({}));
            await consumer.consume(realPlayer);

            expect(publisher.publishToUser).toHaveBeenCalled();
        });
    });

    describe("build payload test", () => {
        afterEach(() => {
            jest.clearAllMocks();
        });
        it("should return expected", async () => {
            // arrange
            consumer.getUserInfo = jest.fn().mockReturnValueOnce({ UID: 1, name: "user", red: 2000 });
            roundQuery.getList.mockReturnValueOnce([]);

            // act
            const actualResult = await consumer.buildPayload(realPlayer);

            // assert
            expect(roundQuery.getList).toHaveBeenCalledWith(definition.numberOfRoundHistory);
            expect(Object.keys(actualResult).length).toBeGreaterThan(0);
            expect(actualResult.user).toEqual({ UID: 1, name: "user", red: 2000, rate: 1000 });
            expect(actualResult.roundHistory).toEqual([]);
        });
    });

    describe("getUserInfo tests", () => {
        describe("when get balance successfully", () => {
            beforeEach(() => {
                getBalance.mockReturnValueOnce({ isOk: true, response: { red: 2000 } });
            });
            it("should call setBalance in GameManagement", async () => {
                // act
                await consumer.getUserInfo(realPlayer);

                // assert
                expect(consumer.gameManagementApiClient.users.setBalance).toHaveBeenCalledWith({ id: realPlayer.UID, balance: 2000 });
            });

            it("should return user info", async () => {
                // arrange
                const user = {
                    UID: 1,
                    name: "player01",
                    avatarId: 1,
                    red: 2000,
                    scoins: 0,
                    currency: "USD",
                    type: false,
                };
                consumer.gameManagementApiClient.users.setBalance.mockReturnValueOnce({ isSuccessful: true, data: { ...user, test: 1 } });

                // act
                const actual = await consumer.getUserInfo(realPlayer);

                // assert
                expect(actual).toEqual(user);
            });
        });

        describe("when get balance has error", () => {
            it("should return userinfo in database", async () => {
                // arrange
                getBalance.mockReturnValueOnce({ isOk: false });
                const user = {
                    UID: 1,
                    name: "player01",
                    avatarId: 1,
                    red: 2000,
                    scoins: 0,
                    currency: "USD",
                    type: false,
                };
                consumer.gameManagementApiClient.users.getUserInfo.mockReturnValueOnce({ isSuccessful: true, data: { ...user, test: 1 } });
                // act
                const actual = await consumer.getUserInfo(realPlayer);

                // assert
                expect(actual).toEqual(user);
            });
        });
    });
});
