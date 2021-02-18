import { stub } from "jest-micro-auto-stub";
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

    const router = new BaseAdminSocketRouter({
        definition,
        gameData,
        adminAuthenticationConsumer,
        adminMonitorConsumer,
        adminDisconnectConsumer,
        logService,
    });

    beforeEach(() => {
        spyOn(logService, "logError");
    });

    it("init_always_binds socket events", () => {
        // arrange
        const socketClient = {
            on: jest.fn(),
        };

        // act
        router.init(socketClient);

        // assert
        expect(socketClient.on).toHaveBeenCalledTimes(2);
    });

    describe("handleDisconnect_", () => {
        it("normal_calls admin disconnect consumer", () => {
            // arrange
            spyOn(adminDisconnectConsumer, "consume");

            // act
            router.handleDisconnect();

            // assert
            expect(adminDisconnectConsumer.consume).toHaveBeenCalled();
        });

        it("have exception_calls admin disconnect consumer", () => {
            // arrange
            spyOn(adminDisconnectConsumer, "consume").and.throwError("error");

            // act
            router.handleDisconnect();

            // assert
            expect(logService.logError).toHaveBeenCalled();
        });
    });

    describe("handleMessage_", () => {
        let payload = {};

        beforeEach(() => {
            payload = {};
        });

        it.each([null, undefined])(
            "authentication in payload is null/undefined_does not call adminAuthenticationConsumer",
            async (authentication) => {
                // arrange
                spyOn(adminAuthenticationConsumer, "consume");
                payload.authentication = authentication;

                // act
                await router.handleMessage(payload);

                // assert
                expect(adminAuthenticationConsumer.consume).not.toHaveBeenCalled();
            }
        );

        it("valid authentication_calls adminAuthenticationConsumer", async () => {
            // arrange
            payload.authentication = {
                jwt: "jwt",
            };

            // act
            await router.handleMessage(payload);

            // assert
            expect(adminAuthenticationConsumer.consume).toHaveBeenCalled();
        });

        it("getnew_validRequest_calls adminMonitorConsumer", async () => {
            // arrange
            payload[definition.name] = { get_new: true };
            spyOn(router, "verify").and.returnValue(true);

            // act
            await router.handleMessage(payload);

            // assert
            expect(adminMonitorConsumer.consume).toHaveBeenCalled();
        });

        it("setresult_validRequest_update settlementResultFromAdmin", async () => {
            // arrange
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

        it("handleMessage_throwException_calls logError", async () => {
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

    describe("verify_", () => {
        const socketClient = {
            id: "socket-id",
            emit: jest.fn(),
            disconnect: jest.fn(),
        };

        it("validSocket_returns true", () => {
            // arrange
            router.socketClient = socketClient;

            gameData.admins[socketClient.id] = socketClient;

            // act & assert
            expect(router.verify()).toBeTruthy();
        });

        it("invalidSocket_returns false", () => {
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
