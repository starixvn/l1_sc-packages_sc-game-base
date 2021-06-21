import express from "express";
import { logger } from "sc-common";

import BaseGameApp from "../base-game-app";
import BaseMetrics from "../base-metrics";

jest.mock("sc-common");
jest.mock("sc-base-database");
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
        // arrange
        it("disabledLogs_not start logger", async () => {
            // arrange
            appConfigs.enabledLogs = false;
            const baseGameApp = new BaseGameApp("serviceName", appConfigs);

            // act
            await baseGameApp.configureServices(app);

            // assert
            expect(logger.start).not.toHaveBeenCalled();
        });

        it("enabledLogs_start logger", async () => {
            // arrange
            appConfigs.enabledLogs = true;
            const baseGameApp = new BaseGameApp("serviceName", appConfigs);

            // act
            await baseGameApp.configureServices(app);

            // assert
            expect(logger.start).toHaveBeenCalled();
        });
    });

    describe("handleMetrics", () => {
        const res = {
            send: jest.fn(),
        };
        const baseMetrics = new BaseMetrics(appConfigs);

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should return error if missing secret key", () => {
            // arrange
            const req = {
                query: jest.fn(),
            };
            const baseGameApp = new BaseGameApp("service name", appConfigs, baseMetrics);

            // act
            baseGameApp.handleMetrics(req, res);

            // assert
            expect(res.send).toHaveBeenCalledWith({ error: true });
        });

        it("should return error and logError if metricQuery throws exception", () => {
            // arrange
            const req = {
                query: { secretKey: "secret" },
            };
            appConfigs.metrics = {
                secretKey: "secret",
            };
            spyOn(baseMetrics, "getMetrics").and.throwError("error");
            const baseGameApp = new BaseGameApp("service name", appConfigs, baseMetrics);

            // act
            baseGameApp.handleMetrics(req, res);

            // assert
            expect(logger.logError).toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith({ error: true });
        });

        it("should return metrics response", () => {
            // arrange
            const req = {
                query: { secretKey: "secret" },
            };
            appConfigs.metrics = {
                secretKey: "secret",
            };
            const metricsResponse = { metrics: "test" };
            spyOn(baseMetrics, "getMetrics").and.returnValue(metricsResponse);
            const baseGameApp = new BaseGameApp("service name", appConfigs, baseMetrics);

            // act
            baseGameApp.handleMetrics(req, res);

            // assert
            expect(res.send).toHaveBeenCalledWith(metricsResponse);
        });
    });

    it("run_always_calls specific methods", async () => {
        const baseGameApp = new BaseGameApp("serviceName", appConfigs);
        spyOn(baseGameApp, "configureServices");
        spyOn(baseGameApp, "initSocketServer");

        // act
        await baseGameApp.run();

        // assert
        expect(baseGameApp.configureServices).toHaveBeenCalled();
        expect(baseGameApp.initSocketServer).toHaveBeenCalled();
    });
});
