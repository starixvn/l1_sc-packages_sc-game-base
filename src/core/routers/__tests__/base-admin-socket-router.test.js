import { stub } from "jest-micro-auto-stub";
import { when } from "jest-when";
import { logger } from "sc-common";

import { AdminAuthenticationConsumer, AdminDisconnectConsumer, AdminMonitorConsumer } from "../../event-consumers";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import BaseAdminSocketRouter from "../base-admin-socket-router";

describe("base admin socket router test", () => {
    const definition = new GameDefinition({ id: 1, name: "game name" });
    const gameData = new GameData(0);

    /** @type {AdminAuthenticationConsumer}*/
    const adminAuthenticationConsumer = stub(AdminAuthenticationConsumer);

    /** @type {AdminMonitorConsumer}*/
    const adminMonitorConsumer = stub(AdminMonitorConsumer);

    /** @type {AdminDisconnectConsumer}*/
    const adminDisconnectConsumer = stub(AdminDisconnectConsumer);

    /** @type {logger}*/
    const logService = stub(logger);

    const appConfigs = {
        sentry: {
            env: "PROD",
        },
    };

    const router = new BaseAdminSocketRouter({
        definition,
        gameData,
        adminAuthenticationConsumer,
        adminMonitorConsumer,
        adminDisconnectConsumer,
        logService,
        appConfigs,
    });

    beforeEach(() => {
        spyOn(logService, "logError");
    });

    describe("init", () => {
        it("should binds socket events", () => {
            // arrange
            const socketClient = {
                on: jest.fn(),
            };

            // act
            router.init(socketClient);

            // assert
            expect(socketClient.on).toHaveBeenCalledTimes(2);
        });
    });

    describe("handleDisconnect_", () => {
        describe("when normal", () => {
            it("should calls admin disconnect consumer", () => {
                // arrange
                spyOn(adminDisconnectConsumer, "consume");

                // act
                router.handleDisconnect();

                // assert
                expect(adminDisconnectConsumer.consume).toHaveBeenCalled();
            });
        });

        describe("when have exception", () => {
            it("should calls admin disconnect consumer", () => {
                // arrange
                spyOn(adminDisconnectConsumer, "consume").and.throwError("error");

                // act
                router.handleDisconnect();

                // assert
                expect(logService.logError).toHaveBeenCalled();
            });
        });
    });

    describe("handleMessage_", () => {
        let payload = {};

        beforeEach(() => {
            payload = {};
        });

        describe("when authentication in payload is null", () => {
            it("should not call adminAuthenticationConsumer", async () => {
                // arrange
                spyOn(adminAuthenticationConsumer, "consume");
                payload.authentication = null;

                // act
                await router.handleMessage(payload);

                // assert
                expect(adminAuthenticationConsumer.consume).not.toHaveBeenCalled();
            });
        });
        describe("when authentication in payload is undefined", () => {
            it("should not call adminAuthenticationConsumer", async () => {
                // arrange
                spyOn(adminAuthenticationConsumer, "consume");
                payload.authentication = undefined;

                // act
                await router.handleMessage(payload);

                // assert
                expect(adminAuthenticationConsumer.consume).not.toHaveBeenCalled();
            });
        });

        describe("valid authentication", () => {
            it("should calls adminAuthenticationConsumer", async () => {
                // arrange
                payload.authentication = {
                    jwt: "jwt",
                };

                // act
                await router.handleMessage(payload);

                // assert
                expect(adminAuthenticationConsumer.consume).toHaveBeenCalled();
            });
        });

        describe("when getnew", () => {
            it("should calls adminMonitorConsumer", async () => {
                // arrange
                payload[definition.name] = { get_new: true };
                spyOn(router, "verify").and.returnValue(true);

                // act
                await router.handleMessage(payload);

                // assert
                expect(adminMonitorConsumer.consume).toHaveBeenCalled();
            });
        });

        describe("when setresult", () => {
            it("should update settlementResultFromAdmin", async () => {
                // arrange
                router.appConfigs.sentry.env = "Local";
                const settlementResult = {
                    roundId: 1,
                    result: { red1: true, red2: false, red3: true, red4: false },
                };
                payload[definition.name] = {
                    set_result: settlementResult,
                };
                spyOn(router, "verify").and.returnValue(true);

                // act
                await router.handleMessage(payload);

                // assert
                expect(gameData.settlementResultFromAdmin).toEqual(settlementResult);
            });
        });

        describe("when setresult_environment_PROD_invalid", () => {
            it("settlementResultFromAdmin is null", async () => {
                // arrange
                router.appConfigs.sentry.env = "PROD";
                gameData.settlementResultFromAdmin = null;
                const settlementResult = {
                    roundId: 1,
                    result: { red1: true, red2: false, red3: true, red4: false },
                };
                payload[definition.name] = {
                    set_result: settlementResult,
                };

                // act
                await router.handleMessage(payload);

                // assert
                expect(gameData.settlementResultFromAdmin).toEqual(null);
            });
        });

        describe("when throwException", () => {
            it("should calls logError", async () => {
                // arrange
                payload.authentication = {
                    jwt: "jwt",
                };
                spyOn(adminAuthenticationConsumer, "consume").and.throwError("error");

                // act
                await router.handleMessage(payload);

                // assert
                expect(logService.logError).toHaveBeenCalled();
            });
        });
    });

    describe("verify_", () => {
        const socketClient = {
            id: "socket-id",
            emit: jest.fn(),
            disconnect: jest.fn(),
        };

        describe("when validSocket", () => {
            it("should returns true", () => {
                // arrange
                router.socketClient = socketClient;

                gameData.admins[socketClient.id] = socketClient;

                // act & assert
                expect(router.verify()).toBeTruthy();
            });
        });

        describe("when invalidSocket", () => {
            it("should returns false", () => {
                // arrange
                gameData.admins = {};
                router.socketClient = socketClient;

                // act
                const result = router.verify();

                // assert
                expect(socketClient.emit).toHaveBeenCalledWith("message", { unauth: { message: "Unauthorized!" } });
                expect(socketClient.disconnect).toHaveBeenCalledWith(true);
                expect(logService.logError).toHaveBeenCalledWith("Admin not found in server storage");
                expect(result).toBeFalsy();
            });
        });
    });
});
