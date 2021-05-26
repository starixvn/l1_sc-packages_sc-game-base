import * as prometheus from "socket.io-prometheus-metrics";

export default class BaseMetrics {
    constructor(appConfigs) {
        this.appConfigs = appConfigs;
        this.socketIOMetrics = null;
    }

    init(socketServer) {
        const metrics = this.appConfigs?.metrics ?? { enable: false, secretKey: "" };
        if (metrics.enable) {
            this.socketIOMetrics = prometheus.metrics(socketServer, {
                collectDefaultMetrics: true,
                createServer: false,
                checkForNewNamespaces: false,
            });
        }
    }

    getMetrics() {
        return this.socketIOMetrics.register.metrics();
    }
}
