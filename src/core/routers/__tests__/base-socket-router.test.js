import { stub } from "jest-micro-auto-stub";
import { logger } from "sc-common";

import { InGameConsumer, PlaceBetConsumer, UserDisconnectConsumer, UserSignInConsumer } from "../../event-consumers";
import { UserSignInPublisher } from "../../event-publishers";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import { HistoryQuery } from "../../query-apis";
import { PlayGamePermissionValidator } from "../../validators";
import BaseSocketRouter from "../base-socket-router";

describe("base socket router test", () => {
    const definition = new GameDefinition({ id: 1, name: "game name" });
    const gameData = new GameData(0);
    /** @type {UserSignInConsumer} */
    const userSignInConsumer = stub(UserSignInConsumer);
    /** @type {InGameConsumer} */
    const inGameConsumer = stub(InGameConsumer);
    /** @type {PlaceBetConsumer} */
    const placeBetConsumer = stub(PlaceBetConsumer);
    /** @type {UserDisconnectConsumer} */
    const userDisconnectConsumer = stub(UserDisconnectConsumer);
    /** @type {UserSignInPublisher} */
    const userSignInPublisher = stub(UserSignInPublisher);
    /** @type {HistoryQuery} */
    const historyQuery = stub(HistoryQuery);
    /** @type {logger} */
    const logService = stub(logger);

    /** @type {PlayGamePermissionValidator} */
    const playGamePermissionValidator = stub(PlayGamePermissionValidator);

    const socketClient = {
        id: "socket-id",
        on: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
    };

    const router = new BaseSocketRouter({
        definition,
        gameData,
        userSignInConsumer,
        inGameConsumer,
        placeBetConsumer,
        userDisconnectConsumer,
        userSignInPublisher,
        historyQuery,
        logService,
        playGamePermissionValidator,
    });

    beforeEach(() => {
        spyOn(logService, "logError");
    });

    it("init_always_binds socket events", () => {
        // act
        router.init(socketClient);

        // assert
        expect(socketClient.on).toHaveBeenCalledTimes(5);
    });

    describe("handlePlaceBet_", () => {
        it("invalidRequest_does not call place bet consumer", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(false);
            spyOn(placeBetConsumer, "consume");

            // act
            await router.handlePlaceBet({});

            // assert
            expect(placeBetConsumer.consume).not.toHaveBeenCalled();
        });

        it("validRequest_calls place bet consumer", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(true);
            spyOn(placeBetConsumer, "consume");

            // act
            await router.handlePlaceBet({});

            // assert
            expect(placeBetConsumer.consume).toHaveBeenCalled();
        });

        it("haveException_logError", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(true);
            spyOn(placeBetConsumer, "consume").and.throwError("error");

            // act
            await router.handlePlaceBet({});

            // assert
            expect(logService.logError).toHaveBeenCalled();
        });
    });

    describe("handleSignIn_", () => {
        it("normal_calls sign in consumer", async () => {
            // arrange
            const payload = {};
            spyOn(userSignInConsumer, "consume");

            // act
            await router.handleSignIn(payload);

            // assert
            expect(userSignInConsumer.consume).toHaveBeenCalledWith(socketClient, payload);
        });

        it("have exception_log error", async () => {
            // arrange
            spyOn(userSignInConsumer, "consume").and.throwError("error");

            // act
            await router.handleSignIn({});

            // assert
            expect(logService.logError).toHaveBeenCalled();
        });
    });

    describe("handleInGame_", () => {
        it("invalidRequest_does not call in game consumer", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(false);
            spyOn(inGameConsumer, "consume");

            // act
            await router.handleInGame();

            // assert
            expect(inGameConsumer.consume).not.toHaveBeenCalled();
        });

        it("validRequest_calls in game consumer", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(true);
            spyOn(inGameConsumer, "consume");

            // act
            await router.handleInGame();

            // assert
            expect(inGameConsumer.consume).toHaveBeenCalled();
        });

        it("have exception_log error", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(true);
            spyOn(inGameConsumer, "consume").and.throwError("error");

            // act
            await router.handleInGame();

            // assert
            expect(logService.logError).toHaveBeenCalled();
        });
    });

    describe("handleGetHistory_", () => {
        it("invalidRequest_does not call query history", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(false);
            spyOn(historyQuery, "queryHistory");

            // act
            await router.handleGetHistory({});

            // assert
            expect(historyQuery.queryHistory).not.toHaveBeenCalled();
        });

        it("validRequest_query history", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(true);
            spyOn(historyQuery, "queryHistory");

            // act
            await router.handleGetHistory({});

            // assert
            expect(historyQuery.queryHistory).toHaveBeenCalled();
            expect(socketClient.emit).toHaveBeenCalled();
        });

        it("have exception_log error", async () => {
            // arrange
            spyOn(router, "verify").and.returnValue(true);
            spyOn(historyQuery, "queryHistory").and.throwError("error");

            // act
            await router.handleGetHistory({});

            // assert
            expect(logService.logError).toHaveBeenCalled();
        });
    });

    describe("handleDisconnect_", () => {
        it("normal_calls user disconnect consumer", () => {
            // arrange
            spyOn(userDisconnectConsumer, "consume");

            // act
            router.handleDisconnect();

            // assert
            expect(userDisconnectConsumer.consume).toHaveBeenCalledWith(socketClient);
        });

        it("have exception_log error", () => {
            // arrange
            spyOn(userDisconnectConsumer, "consume").and.throwError("error");

            // act
            router.handleDisconnect();

            // assert
            expect(logService.logError).toHaveBeenCalled();
        });
    });

    describe("verify_", () => {
        it("validSocket_returns true", async () => {
            // arrange
            router.socketClient = socketClient;

            gameData.realPlayers[socketClient.id] = socketClient;
            spyOn(playGamePermissionValidator, "validate").and.returnValue(true);

            // act & assert
            expect(await router.verify()).toBeTruthy();
        });

        it("invalidSocket_returns false", async () => {
            // arrange
            gameData.realPlayers = {};
            router.socketClient = socketClient;
            spyOn(userSignInPublisher, "publishUnauthorizedMessage");

            // act
            const result = await router.verify();

            // assert
            expect(userSignInPublisher.publishUnauthorizedMessage).toHaveBeenCalled();
            expect(socketClient.disconnect).toHaveBeenCalledWith(true);
            expect(logService.logError).toHaveBeenCalledWith("User not found in server storage");
            expect(result).toBeFalsy();
        });
    });
});
