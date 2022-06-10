import mongoose from "mongoose";
import { logger, utils } from "sc-common";

import { HistoryQuery, MetricQuery } from "../query-apis";
import GameData from "./../game-data";
import Axios from "axios";

export default class HttpRouter {
    /**
     * @param {Object} appConfigs
     * @param {GameData} gameData]
     * @param {HistoryQuery} historyQuery
     * @param {mongoose.Model} userSessionsRepository
     * @param {MetricQuery} metricQuery
     * @param {logger} ldependencies.logService
     */
    constructor(appConfigs, gameData, historyQuery, userSessionsRepository, metricQuery, logService) {
        this.appConfigs = appConfigs;
        this.gameData = gameData;
        this.historyQuery = historyQuery;
        this.userSessionsRepository = userSessionsRepository;
        this.metricQuery = metricQuery;
        this.logService = logService;
    }

    init(app) {
        app.get(
            "/api/onlineusers",
            utils.authentication.useAuthenticate({
                authUrl: this.appConfigs.apiSettings.authUrl,
                audiences: this.appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleOnlineUsers(res)
        );

        app.post(
            "/api/history",
            (_req, res, next) => this.verifySession(_req, res, next),
            (_req, res) => this.handleHistoryRequest(_req, res)
        );

        app.get("/api/metrics", (_req, res) => this.handleMetrics(_req, res));
    }

    async verifySession(req, res, next) {
        const { session, username } = req.body;
        const url = `${this.appConfigs.userServiceSettings.url}/auth/session/verify`;
        const params = { session, username, browserUserAgent: req.headers["user-agent"] };
        const requestConfigs = { timeout: this.appConfigs.userServiceSettings.requestTimeout };
        const verifySessionResult = (await Axios.post(url, params, requestConfigs)).data;

        if (verifySessionResult.isSuccessful) {
            next();
        } else {
            res.sendStatus(401);
        }
    }

    async handleHistoryRequest(req, res) {
        try {
            const { session, page, pageSize } = req.body;

            const userSession = await this.userSessionsRepository.findOne({ sessionId: session }).lean().exec();
            const result = await this.historyQuery.queryHistory({ UID: userSession.userId }, +page, +pageSize);

            res.send(result);
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }

    handleOnlineUsers(res) {
        try {
            const onlineUsers = this.collectOnlineUsers();

            res.send(onlineUsers);
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }

    collectOnlineUsers() {
        const users = this.mapRealUsers(Object.values(this.gameData.realPlayers));

        return {
            totalRealPlayer: users.realUsers.length,
            realUsers: users.realUsers,
            totalTestPlayer: users.testUsers.length,
            testUsers: users.testUsers,
        };
    }

    mapRealUsers(players) {
        const testUsers = [];
        const realUsers = [];

        players.forEach((player) => {
            if (player && player.session && player.socketClient && player.socketClient.connected) {
                const user = {
                    name: player.session.memberName,
                    id: player.session.memberId,
                    currency: player.session.currencyName,
                    character: player.session.characterName,
                    system: player.session.system,
                    partnerId: player.session.partnerId,
                    operatorId: player.session.partnerId,
                };

                if (player.session.isTestCurrency) {
                    testUsers.push(user);
                } else {
                    realUsers.push(user);
                }
            }
        });

        return { testUsers, realUsers };
    }

    handleMetrics(req, res) {
        try {
            const { secretKey } = req?.query || {};

            if (secretKey) {
                res.send(this.metricQuery.getMetrics(secretKey));

                return;
            }

            res.send({ error: true });
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }
}
