import * as prom from "prom-client";
import { Server } from "socket.io";
import * as prometheus from "socket.io-prom-metrics";

export default class BaseMetrics {
    constructor(appConfigs) {
        this.appConfigs = appConfigs;
        this.socketIOMetrics = null;
        this.metricsEnabled = false;
    }

    /**
     * @param {Server} socketServer
     */
    init(socketServer) {
        const metrics = this.appConfigs?.metrics ?? { enable: false, secretKey: "" };
        this.metricsEnabled = metrics.enable;
        if (this.metricsEnabled) {
            this.socketIOMetrics = prometheus.metrics(socketServer, {
                collectDefaultMetrics: true,
                createServer: false,
                checkForNewNamespaces: true,
            });

            this.initBetProcessedTimeMetrics();
        }
    }

    getMetrics() {
        return this.socketIOMetrics.register.metrics();
    }

    initBetProcessedTimeMetrics() {
        this.socketIOMetrics.metrics.betProcessedTime = new prom.Gauge({
            name: "bet_process_duration_seconds",
            help: "Total seconds for processing bet",
        });
    }

    collectBetProcessedTime(totalTime) {
        if (this.socketIOMetrics) {
            this.socketIOMetrics.metrics.betProcessedTime.set(totalTime);
        }
    }
}
