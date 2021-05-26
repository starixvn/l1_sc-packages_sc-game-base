import BaseMetrics from "../base-metrics";

export default class MetricQuery {
    /**
     * @param {BaseMetrics} baseMetrics
     */

    constructor(appConfigs, baseMetrics) {
        this.appConfigs = appConfigs;
        this.baseMetrics = baseMetrics;
    }

    getMetrics(metricSecretKey) {
        return metricSecretKey === this.appConfigs.metrics?.secretKey ? this.baseMetrics.getMetrics() : "";
    }
}
