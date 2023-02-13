import { Domains } from "../models";
import cron from "cron";
import { logger } from "sc-common";

let configuredDomains = "";

export const updateConfiguredDomains = (value) => {
    configuredDomains = value;
};

const queryDomains = async () => {
    try {
        const domains = await Domains.findOne({}).lean().exec();
        configuredDomains = domains.value;
    } catch (err) {
        logger.logError("queryDomains error: " + err.toString());
    }
};

export const isAllowAccess = (origin) => {
    const mainDomain = getMainDomain(origin);
    return !mainDomain || !configuredDomains || configuredDomains.includes(mainDomain);
};

export const getMainDomain = (domain) => {
    if (!domain) {
        return "";
    }

    domain = domain.replace(/^https?:\/\//, "");

    const domainParts = domain.split(".");
    if (domainParts.length < 2) {
        return "";
    }
    return `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}`;
};

export const startCorsCron = () => {
    const job = new cron.CronJob("*/10 * * * *", queryDomains, () => {
        logger.logError("cors job unexpectedly stopped");
        job.start();
    });

    queryDomains();
    job.start();
};
