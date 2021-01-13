import awilix from "awilix";
import { endGame, getBalance, placeBet } from "sc-base-apis";
import { gameConfigs, userInfos, userSessions } from "sc-base-database";
import { logger } from "sc-common";

import * as Crons from "./crons";
import * as EventConsumers from "./event-consumers";
import * as EventPublishers from "./event-publishers";
import GameData from "./game-data";
import GameDefinition from "./game-definition";
import { authenticationHelpers } from "./helpers";
import { HistoryQuery, RoundQuery } from "./query-apis";
import * as Routers from "./routers";

const { asClass, asFunction, asValue, createContainer, InjectionMode } = awilix;

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
            gameName: asValue(definition.name),
            definition: asValue(definition),
            gameData: asValue(gameData),
        });

        this.registerModels();
        this.registerApis();
        this.registerPublishers();
        this.registerConsumers();
        this.registerCrons();
        this.registerRouters();

        return this.container;
    }

    registerModels() {
        this.container.register({
            gameConfigsRepository: asValue(gameConfigs),
            userInfosRepository: asValue(userInfos),
            userSessionsRepository: asValue(userSessions),
        });

        this.container.register({
            roundsRepository: asValue(undefined),
            betRepository: asValue(undefined),
            betLogRepository: asValue(undefined),
        });
    }

    registerApis() {
        this.container.register({
            endGame: asValue(endGame),
            getBalance: asValue(getBalance),
            placeBet: asValue(placeBet),
            logService: asValue(logger),
            mainServiceCommunicator: asValue(authenticationHelpers),
            roundQuery: asClass(RoundQuery).singleton(),
            historyQuery: asClass(HistoryQuery).singleton(),
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
            adminAuthenticationConsumer: asClass(EventConsumers.AdminAuthenticationConsumer).singleton().proxy(),
            adminDisconnectConsumer: asClass(EventConsumers.AdminDisconnectConsumer).singleton(),
            adminMonitorConsumer: asClass(EventConsumers.AdminMonitorConsumer).singleton(),
        });

        this.container.register({
            inGameConsumer: asClass(EventConsumers.InGameConsumer).singleton(),
            placeBetConsumer: asClass(EventConsumers.PlaceBetConsumer).singleton(),
            settleGameRoundConsumer: asClass(EventConsumers.SettleGameRoundConsumer).singleton().proxy(),
            userDisconnectConsumer: asClass(EventConsumers.UserDisconnectConsumer).singleton(),
            userSignInConsumer: asClass(EventConsumers.UserSignInConsumer).singleton(),
        });
    }

    registerCrons() {
        this.container.register({
            bot: asClass(Crons.BaseBot).singleton(),
            gameCron: asClass(Crons.BaseGameCron).singleton().proxy(),
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
}
