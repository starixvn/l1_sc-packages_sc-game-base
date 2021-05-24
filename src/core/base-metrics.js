import * as prometheus from "socket.io-prometheus-metrics";

export default class BaseMetrics {
    constructor(appConfigs) {
        this.appConfigs = appConfigs;
        this.socketIOMetrics = null;
    }

    init(socketServer) {
        const enableCollectMetrics = this.appConfigs?.enableCollectMetrics ?? false;
        if (enableCollectMetrics) {
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
