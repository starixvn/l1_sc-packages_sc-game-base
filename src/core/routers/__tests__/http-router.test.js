import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";

import { HttpRouter } from "..";
import GameData from "../../game-data";
import { HistoryQuery, MetricQuery } from "../../query-apis";

jest.mock("sc-common");

describe("http router test", () => {
    const appConfigs = {
        apiSettings: {
            authUrl: "http://localhost",
        },
        authenticateSettings: {
            audiences: [],
        },
    };
    const gameData = new GameData(0);
    const app = { get: jest.fn(), post: jest.fn() };
    /** @type {HistoryQuery} */
    const historyQuery = stub(HistoryQuery);
    /** @type {logger} */
    const logService = stub(logger);
    /** @type {mongoose.Model}*/
    const userSessionsRepository = stubMongoose(mongoose.Model);
    /** @type {MetricQuery} */
    const metricQuery = stub(MetricQuery);

    const router = new HttpRouter(appConfigs, gameData, historyQuery, userSessionsRepository, metricQuery, logService);

    it("init_always_calls app.get", () => {
        // act
        router.init(app);

        // assert
        expect(app.get).toHaveBeenCalled();
    });

    describe("handleOnlineUsers_", () => {
        const res = {
            send: jest.fn(),
        };

        it("normal_response online users", () => {
            // arrange
            const onlineUsers = [];
            spyOn(router, "collectOnlineUsers").and.returnValue(onlineUsers);

            // act
            router.handleOnlineUsers(res);

            // assert
            expect(res.send).toHaveBeenCalledWith(onlineUsers);
        });

        it("have exception_response error", () => {
            // arrange
            spyOn(router, "collectOnlineUsers").and.throwError("error");

            // act
            router.handleOnlineUsers(res);

            // assert
            expect(logService.logError).toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith({ error: true });
        });
    });

    it("collectOnlineUsers_always_returns correct data", () => {
        // arrange
        const users = {
            realUsers: [{ id: 1, name: "user1", isTestCurrency: false }],
            testUsers: [{ id: 2, name: "user2", isTestCurrency: true }],
        };
        spyOn(router, "mapRealUsers").and.returnValue(users);
        const expectedResult = {
            totalRealPlayer: 1,
            realUsers: [{ id: 1, name: "user1", isTestCurrency: false }],
            totalTestPlayer: 1,
            testUsers: [{ id: 2, name: "user2", isTestCurrency: true }],
        };

        // act
        const actualResult = router.collectOnlineUsers();

        // assert
        expect(actualResult).toEqual(expectedResult);
    });

    it("mapRealUsers_always_returns correct data", () => {
        // arrange
        const socketClient = {
            connected: true,
        };
        const players = [
            {
                session: {
                    memberName: "player1",
                    memberId: 1,
                    isTestCurrency: false,
                    characterName: "character1",
                    currencyName: "USD",
                    partnerId: "1W",
                    system: 1,
                },
                socketClient,
            },
            {
                session: {
                    memberName: "player2",
                    memberId: 2,
                    isTestCurrency: true,
                    characterName: "character2",
                    currencyName: "USD",
                    partnerId: "1W",
                    system: 1,
                },
                socketClient,
            },
        ];

        const expectedResult = {
            testUsers: [{ name: "player2", id: 2, character: "character2", currency: "USD", partnerId: "1W", system: 1 }],
            realUsers: [{ name: "player1", id: 1, character: "character1", currency: "USD", partnerId: "1W", system: 1 }],
        };

        // act
        const actualResult = router.mapRealUsers(players);

        // assert
        expect(actualResult).toEqual(expectedResult);
    });

    describe("handleMetrics", () => {
        const res = {
            send: jest.fn(),
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should return error if missing secret key", () => {
            // arrange
            const req = {
                query: jest.fn(),
            };

            // act
            router.handleMetrics(req, res);

            // assert
            expect(res.send).toHaveBeenCalledWith({ error: true });
        });

        it("should return error and logError if metricQuery throws exception", () => {
            // arrange
            const req = {
                query: { secretKey: "secret" },
            };
            spyOn(metricQuery, "getMetrics").and.throwError("error");

            // act
            router.handleMetrics(req, res);

            // assert
            expect(logService.logError).toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith({ error: true });
        });

        it("should return metrics response", () => {
            // arrange
            const req = {
                query: { secretKey: "secret" },
            };
            const metricsResponse = { metrics: "test" };
            spyOn(metricQuery, "getMetrics").and.returnValue(metricsResponse);

            // act
            router.handleMetrics(req, res);

            // assert
            expect(res.send).toHaveBeenCalledWith(metricsResponse);
        });
    });
});
