import { stub } from "jest-micro-auto-stub";
import { logger } from "sc-common";
jest.mock("sc-common");

import { InGameConsumer, PlaceBetConsumer, UserDisconnectConsumer, UserSignInConsumer } from "../../event-consumers";
import { UserSignInPublisher } from "../../event-publishers";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import { HistoryQuery } from "../../query-apis";
import { PlayGamePermissionValidator } from "../../validators";
import BaseSocketRouter from "../base-socket-router";

describe("base socket router test", () => {
    const ForbiddenCode = 403;

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
        spyOn(logService, "logWarning");
    });

    describe("init", () => {
        it("should binds socket events", () => {
            // act
            router.init(socketClient);

            // assert
            expect(socketClient.on).toHaveBeenCalledTimes(6);
        });
    });

    describe("handlePlaceBet", () => {
        describe("when invalidRequest", () => {
            it("should not call place bet consumer", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(false);
                spyOn(placeBetConsumer, "consume");

                // act
                await router.handlePlaceBet({});

                // assert
                expect(placeBetConsumer.consume).not.toHaveBeenCalled();
            });
        });

        describe("when validRequest", () => {
            it("should calls place bet consumer", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(true);
                spyOn(placeBetConsumer, "consume");

                // act
                await router.handlePlaceBet({});

                // assert
                expect(placeBetConsumer.consume).toHaveBeenCalled();
            });
        });

        describe("when haveException", () => {
            it("should logError", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(true);
                spyOn(placeBetConsumer, "consume").and.throwError("error");

                // act
                await router.handlePlaceBet({});

                // assert
                expect(logService.logError).toHaveBeenCalled();
            });
        });
    });

    describe("handleSignIn", () => {
        describe("when normal", () => {
            it("should calls sign in consumer", async () => {
                // arrange
                const payload = {};
                spyOn(userSignInConsumer, "consume");

                // act
                await router.handleSignIn(payload);

                // assert
                expect(userSignInConsumer.consume).toHaveBeenCalledWith(socketClient, payload);
            });
        });

        describe("when have exception", () => {
            it("should call handleError", async () => {
                // arrange
                spyOn(userSignInConsumer, "consume").and.throwError("error");
                spyOn(router, "handleError");

                // act
                await router.handleSignIn({});

                // assert
                expect(router.handleError).toHaveBeenCalled();
            });
        });
    });

    describe("handleInGame", () => {
        describe("when invalidRequest", () => {
            it("should not call in game consumer", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(false);
                spyOn(inGameConsumer, "consume");

                // act
                await router.handleInGame();

                // assert
                expect(inGameConsumer.consume).not.toHaveBeenCalled();
            });
        });

        describe("when validRequest", () => {
            it("should calls in game consumer", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(true);
                spyOn(inGameConsumer, "consume");

                // act
                await router.handleInGame();

                // assert
                expect(inGameConsumer.consume).toHaveBeenCalled();
            });
        });

        describe("when have exception", () => {
            it("should log error", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(true);
                spyOn(inGameConsumer, "consume").and.throwError("error");

                // act
                await router.handleInGame();

                // assert
                expect(logService.logError).toHaveBeenCalled();
            });
        });
    });

    describe("handleGetHistory", () => {
        describe("when invalidRequest", () => {
            it("should not call query history", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(false);
                spyOn(historyQuery, "queryHistory");

                // act
                await router.handleGetHistory({});

                // assert
                expect(historyQuery.queryHistory).not.toHaveBeenCalled();
            });
        });

        describe("when validRequest", () => {
            it("should query history", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(true);
                spyOn(historyQuery, "queryHistory");

                // act
                await router.handleGetHistory({});

                // assert
                expect(historyQuery.queryHistory).toHaveBeenCalled();
                expect(socketClient.emit).toHaveBeenCalled();
            });
        });

        describe("when have exception", () => {
            it("should log error", async () => {
                // arrange
                spyOn(router, "verify").and.returnValue(true);
                spyOn(historyQuery, "queryHistory").and.throwError("error");

                // act
                await router.handleGetHistory({});

                // assert
                expect(logService.logError).toHaveBeenCalled();
            });
        });
    });

    describe("handleDisconnect", () => {
        describe("when normal", () => {
            it("should calls user disconnect consumer", () => {
                // arrange
                spyOn(userDisconnectConsumer, "consume");

                // act
                router.handleDisconnect();

                // assert
                expect(userDisconnectConsumer.consume).toHaveBeenCalledWith(socketClient);
            });
        });

        describe("when have exception", () => {
            it("should log error", () => {
                // arrange
                spyOn(userDisconnectConsumer, "consume").and.throwError("error");

                // act
                router.handleDisconnect();

                // assert
                expect(logService.logError).toHaveBeenCalled();
            });
        });
    });

    describe("verify", () => {
        describe("when valid Socket", () => {
            it("should returns true", async () => {
                // arrange
                router.socketClient = socketClient;

                gameData.realPlayers[socketClient.id] = socketClient;
                spyOn(playGamePermissionValidator, "validate").and.returnValue(true);

                // act & assert
                expect(await router.verify()).toBeTruthy();
            });
        });

        describe("when invalid socket", () => {
            it("should returns false", async () => {
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

    describe("handleError", () => {
        let payload;

        describe("when Forbidden Code", () => {
            it("should call logService.logWarning", () => {
                // Arrange
                payload = { username: "username" };
                const e = { response: { status: ForbiddenCode } };

                // Act
                router.handleError(payload, e);

                // Assert
                expect(router.logService.logWarning).toHaveBeenCalled();
            });
        });

        describe("when Other Code", () => {
            it("should call logService.logError", () => {
                // Arrange
                payload = { username: "username" };
                const e = { response: { status: 404 } };

                // Act
                router.handleError(payload, e);

                // Assert
                expect(router.logService.logError).toHaveBeenCalled();
            });
        });

        describe("when not have response", () => {
            it("should call logService.logError", () => {
                // Arrange
                payload = { username: "username" };
                const e = { response: null };

                // Act
                router.handleError(payload, e);

                // Assert
                expect(router.logService.logError).toHaveBeenCalled();
            });
        });
    });
});
