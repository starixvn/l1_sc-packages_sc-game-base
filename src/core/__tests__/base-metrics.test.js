import { stub } from "jest-micro-auto-stub";
import socketIo from "socket.io";
import * as prometheus from "socket.io-prom-metrics";

import BaseMetrics from "../base-metrics";

describe("BaseMetrics test", () => {
    const appConfigs = {};
    const socketServer = stub(socketIo);
    const prometheusSocket = stub(prometheus);

    it("BaseMetrics should not init if missing configuration", () => {
        // arrange
        const baseMetrics = new BaseMetrics(appConfigs);
        spyOn(prometheusSocket, "metrics").and.returnValue({});

        // act
        baseMetrics.init(socketServer);

        // assert
        expect(prometheusSocket.metrics).not.toHaveBeenCalled();
    });

    it("BaseMetrics should not init if disabled", () => {
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

    it("BaseMetrics should init if enabled", () => {
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
