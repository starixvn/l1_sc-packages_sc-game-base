import { asClass, asValue } from "awilix";

import { ContainerRegistry } from "./../core";
import * as Crons from "./crons";
import * as EventConsumers from "./event-consumers";
import * as EventPublishers from "./event-publishers";
import * as Routers from "./routers";

export default class TableContainerRegistry extends ContainerRegistry {
    registerModels() {
        super.registerModels();

        this.container.register({
            tempBetsRepository: asValue(undefined),
        });
    }

    registerPublishers() {
        super.registerPublishers();

        this.container.register({
            publisher: asClass(EventPublishers.TableBaseEventPublisher).singleton(),
            placeBetPublisher: asClass(EventPublishers.TablePlaceBetPublisher).singleton(),
            userSignInPublisher: asClass(EventPublishers.TableUserSignInPublisher).singleton(),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            inGameConsumer: asClass(EventConsumers.TableInGameConsumer).singleton(),
            userDisconnectConsumer: asClass(EventConsumers.TableOutGameConsumer).singleton(),
            settleGameRoundConsumer: asClass(EventConsumers.TableSettleGameRoundConsumer).singleton().proxy(),
            userSignInConsumer: asClass(EventConsumers.TableUserSignInConsumer).singleton(),
        });
    }

    registerCrons() {
        super.registerCrons();

        this.container.register({
            bot: asClass(Crons.TableGameBot).singleton(),
            gameCron: asClass(Crons.TableGameCron).singleton().proxy(),
            processBetQueue: asClass(Crons.TableProcessBetQueue).singleton().proxy(),
        });
    }

    registerRouters() {
        super.registerRouters();

        this.container.register({
            httpRouter: asClass(Routers.TableHttpRouter),
        });
    }
}
