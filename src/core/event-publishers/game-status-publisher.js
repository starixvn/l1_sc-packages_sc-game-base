import BaseEventPublisher from "./base-event-publisher";

export default class GameStatusPublisher extends BaseEventPublisher {
    publishDisableGameStatus() {
        const disabledMessage = this.gameData.gameConfigs.disabled_message ?? "";
        const payload = { um: true, um_message: disabledMessage };

        this.publishToAllUsers(payload);
        this.publishToAllAdmins(payload);
    }

    publishEnablingGameStatus() {
        const { gameConfigs, remainingTime, roundId } = this.gameData;
        const configs = {
            minbet: gameConfigs.minbet,
            maxbet: gameConfigs.maxbet,
            choices_maxbet: gameConfigs.choices_maxbet,
            odds: gameConfigs.odds,
            enableFreeBet: gameConfigs.enableFreeBet,
        };

        this.publishToAllUsers({ gameConfigs: configs, remainingTime });
        this.publishToAllAdmins({ remainingTime, roundId });
    }

    publishStartGame() {
        this.publishToAllUsers({ remainingTime: this.gameData.remainingTime });
    }
}
