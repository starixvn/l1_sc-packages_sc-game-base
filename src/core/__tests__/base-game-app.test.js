import express from "express";
import { logger } from "sc-common";
import { Server } from "socket.io";

import BaseGameApp from "../base-game-app";

jest.mock("sc-common");
jest.mock("../helpers");

const appConfigs = {
    database: {
        url: "",
        options: {},
    },
    hostingPort: 500,
};
const app = express();

describe("base game app test", () => {
    logger.start.mockReturnValue(jest.fn());
    logger.logError.mockReturnValue(jest.fn());

    describe("configureServices_", () => {
        describe("when disabledLogs", () => {
            // arrange
            it("should not start logger", async () => {
                // arrange
                appConfigs.enabledLogs = false;
                const baseGameApp = new BaseGameApp("serviceName", appConfigs);

                // act
                await baseGameApp.configureServices(app);

                // assert
                expect(logger.start).not.toHaveBeenCalled();
            });
        });

        describe("when enabledLogs", () => {
            it("should start logger", async () => {
                // arrange
                appConfigs.enabledLogs = true;
                const baseGameApp = new BaseGameApp("serviceName", appConfigs);

                // act
                await baseGameApp.configureServices(app);

                // assert
                expect(logger.start).toHaveBeenCalled();
            });
        });
    });

    it("should call configureServices", async () => {
        const baseGameApp = new BaseGameApp("serviceName", appConfigs);
        spyOn(baseGameApp, "configureServices");
        spyOn(baseGameApp, "initSocketServer");

        // act
        await baseGameApp.run();

        // assert
        expect(baseGameApp.configureServices).toHaveBeenCalled();
    });

    it("should call initSocketServer", async () => {
        const baseGameApp = new BaseGameApp("serviceName", appConfigs);
        spyOn(baseGameApp, "configureServices");
        spyOn(baseGameApp, "initSocketServer");

        // act
        await baseGameApp.run();

        // assert
        expect(baseGameApp.initSocketServer).toHaveBeenCalled();
    });
});
