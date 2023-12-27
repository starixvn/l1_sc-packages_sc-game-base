import cron from "cron";
import { logger } from "sc-common";
import GameManagementApiClientFactory, { getOrDefault } from "../game-management-api";

let configuredDomains = "";
let domains = null;

export const updateConfiguredDomains = (value) => {
    configuredDomains = value;
};

const queryDomains = async (appConfigs) => {
    try {
        const gameManagementApiClientFactory = new GameManagementApiClientFactory(appConfigs);
        domains = await getOrDefault(gameManagementApiClientFactory.instance().domain.getDomain(), domains);
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

export const startCorsCron = (appConfigs) => {
    const job = new cron.CronJob(
        "*/10 * * * *",
        () => queryDomains(appConfigs),
        () => {
            logger.logError("cors job unexpectedly stopped");
            job.start();
        }
    );

    queryDomains(appConfigs);
    job.start();
};
