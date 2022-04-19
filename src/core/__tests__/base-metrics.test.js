import { stub } from "jest-micro-auto-stub";
import socketIo from "socket.io";
import * as prometheus from "socket.io-prom-metrics";

import BaseMetrics from "../base-metrics";

describe("BaseMetrics test", () => {
    const appConfigs = {};
    const socketServer = stub(socketIo);
    const prometheusSocket = stub(prometheus);

    describe("when missing configuration", () => {
        it("BaseMetrics should not init ", () => {
            // arrange
            const baseMetrics = new BaseMetrics(appConfigs);
            spyOn(prometheusSocket, "metrics").and.returnValue({});

            // act
            baseMetrics.init(socketServer);

            // assert
            expect(prometheusSocket.metrics).not.toHaveBeenCalled();
        });
    });

    describe("when disabled", () => {
        it("BaseMetrics should not init", () => {
            // arrange
            appConfigs.metrics = {
                enable: false,
            };
            const baseMetrics = new BaseMetrics(appConfigs);
            spyOn(prometheusSocket, "metrics").and.returnValue({});

            // act
            baseMetrics.init(socketServer);

            // assert
            expect(prometheusSocket.metrics).not.toHaveBeenCalled();
        });
    });

    describe("when enabled", () => {
        it("BaseMetrics should init", () => {
            // arrange
            appConfigs.metrics = {
                enable: true,
            };
            const baseMetrics = new BaseMetrics(appConfigs);
            spyOn(prometheusSocket, "metrics").and.returnValue({ metrics: {} });

            // act
            baseMetrics.init(socketServer);

            // assert
            expect(prometheusSocket.metrics).toHaveBeenCalled();
        });
    });
});
