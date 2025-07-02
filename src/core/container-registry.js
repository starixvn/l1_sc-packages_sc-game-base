import { asClass, asFunction, asValue, createContainer, InjectionMode } from "awilix";
import { endGame, getBalance, placeBet } from "sc-base-apis";
import { logger } from "sc-common";
import { GamePromotionApiClient } from "@sc/game-promotion-api-client";

import * as Crons from "./crons";
import * as EventConsumers from "./event-consumers";
import * as EventPublishers from "./event-publishers";
import * as EventInterceptors from "./event-interceptors";
import GameData from "./game-data";
import GameDefinition from "./game-definition";
import GameManagementApiClientFactory from "./game-management-api";
import { PromotionClient } from "./promotion-client";

import * as Routers from "./routers";
import { PlayGamePermissionValidator } from "./validators";
import { RoundQuery, HistoryQuery, MetricQuery } from "./query-apis";

export default class ContainerRegistry {
    /**
     * @param {InjectionMode} defaultInjectionMode
     */
    constructor(defaultInjectionMode = InjectionMode.CLASSIC) {
        this.container = createContainer({ injectionMode: defaultInjectionMode });
    }

    /**
     * @param {Object} appConfigs
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     */
    register(appConfigs, definition, gameData) {
        this.container.register({
            appConfigs: asValue(appConfigs),
            adminSecretKey: asValue(appConfigs.adminSecretKey),
            gameId: asValue(definition.id),
            gameName: asValue(definition.name),
            definition: asValue(definition),
            gameData: asValue(gameData),
        });

        this.registerModels();
        this.registerApis();
        this.registerPublishers();
        this.registerValidators();
        this.registerConsumers();
        this.registerCrons();
        this.registerRouters();
        this.registerGameManagementService();
        this.registerPFSettings();
        this.registerPromotionApiClient();
        this.registerInterceptors();

        // Register interceptor arrays after all interceptors are registered
        this.registerInterceptorArrays();

        return this.container;
    }

    registerPFSettings() {
        this.container.register({
            maxCombinedClientSeeds: asValue(0),
        });
    }

    registerModels() {
        this.container.register({
            resultsRepository: asValue(undefined),
            roundsRepository: asValue(undefined),
            betsRepository: asValue(undefined),
            betLogsRepository: asValue(undefined),
        });
    }

    registerApis() {
        this.container.register({
            endGame: asValue(endGame),
            getBalance: asValue(getBalance),
            placeBet: asValue(placeBet),
            logService: asValue(logger),
            roundQuery: asClass(RoundQuery).singleton(),
            historyQuery: asClass(HistoryQuery).singleton(),
            metricQuery: asClass(MetricQuery).singleton(),
        });
    }

    registerPublishers() {
        this.container.register({
            adminPublisher: asClass(EventPublishers.AdminPublisher).singleton(),
            publisher: asClass(EventPublishers.BaseEventPublisher).singleton(),
            gameStatusPublisher: asClass(EventPublishers.GameStatusPublisher).singleton(),
            placeBetPublisher: asClass(EventPublishers.PlaceBetPublisher).singleton(),
            roundResultPublisher: asClass(EventPublishers.RoundResultPublisher).singleton(),
            runningRoundInfoPublisher: asClass(EventPublishers.RunningRoundInfoPublisher).singleton(),
            userBetResultPublisher: asClass(EventPublishers.UserBetResultPublisher).singleton(),
            userSignInPublisher: asClass(EventPublishers.UserSignInPublisher).singleton(),
        });
    }

    registerConsumers() {
        this.container.register({
            adminAuthenticationConsumer: asClass(EventConsumers.AdminAuthenticationConsumer).singleton(),
            adminDisconnectConsumer: asClass(EventConsumers.AdminDisconnectConsumer).singleton(),
            adminMonitorConsumer: asClass(EventConsumers.AdminMonitorConsumer).singleton(),
        });

        this.container.register({
            inGameConsumer: asClass(EventConsumers.InGameConsumer).singleton(),
            placeBetConsumer: asClass(EventConsumers.PlaceBetConsumer).singleton(),
            redeemConsumer: asClass(EventConsumers.RedeemConsumer).singleton().proxy(),
            settleGameRoundConsumer: asClass(EventConsumers.SettleGameRoundConsumer).singleton().proxy(),
            userDisconnectConsumer: asClass(EventConsumers.UserDisconnectConsumer).singleton(),
            userSignInConsumer: asClass(EventConsumers.UserSignInConsumer).singleton().proxy(),
            roundResultConsumer: asClass(EventConsumers.RoundResultConsumer).singleton(),
            roundIdConsumer: asClass(EventConsumers.RoundIdConsumer).singleton(),
            provablyFairConsumer: asClass(EventConsumers.ProvablyFairConsumer).singleton(),
            unsettledRoundConsumer: asClass(EventConsumers.UnsettledRoundConsumer).singleton().proxy(),
            gameResultServiceConsumer: asClass(EventConsumers.GameResultServiceConsumer).proxy(),
        });
    }

    registerCrons() {
        this.container.register({
            baseBot: asClass(Crons.BaseBot).singleton(),
            baseGameCron: asClass(Crons.BaseGameCron).singleton().proxy(),
            processBetQueue: asClass(Crons.ProcessBetQueue).singleton().proxy(),
        });
    }

    registerRouters() {
        this.container.register({
            adminSocketRouter: asClass(Routers.BaseAdminSocketRouter).proxy(),
            socketRouter: asClass(Routers.BaseSocketRouter).proxy(),
            httpRouter: asClass(Routers.HttpRouter),
        });
    }

    registerValidators() {
        this.container.register({
            playGamePermissionValidator: asClass(PlayGamePermissionValidator).singleton(),
        });
    }

    registerGameManagementService() {
        this.container.register({
            gameManagementApiClientFactory: asClass(GameManagementApiClientFactory).singleton(),
        });
    }

    registerPromotionApiClient() {
        this.container.register({
            gamePromotionApiClient: asClass(PromotionClient).singleton().proxy(),
        });
    }

    registerInterceptors() {
        this.container.register({
            promotionBetInterceptor: asClass(EventInterceptors.PromotionBetInterceptor).singleton().proxy(),
        });
    }

    registerInterceptorArrays() {
        this.container.register({
            betEventInterceptors: asFunction(() => {
                const interceptors = [];

                const promotionBetInterceptor = this.container.resolve("promotionBetInterceptor");
                if (promotionBetInterceptor) {
                    interceptors.push(promotionBetInterceptor);
                }

                return interceptors;
            }).singleton(),
        });
    }
}
