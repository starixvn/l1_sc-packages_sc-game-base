import { BasePublisher } from "../event-publishers";
import { RoundQuery } from "../query-apis";

export default class InGameConsumer {
    constructor({ definition, gameData, roundQuery, publisher }) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundQuery = roundQuery ?? new RoundQuery(definition);
        this.publisher = publisher ?? new BasePublisher(definition.name, gameData);
    }

    async consume(realPlayer) {
        const payload = await this.buildPayload(realPlayer);
        realPlayer.socketClient.emit(this.definition.name, payload);
    }

    async buildPayload(realPlayer) {
        const maxNumberOfRounds = 100;
        const { minbet, maxbet, choices_maxbet, odds, enableFreeBet } = this.gameData.gameConfigs;
        const { remainingTime, totalBets } = this.gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds, enableFreeBet };
        const { betTracks: ownBets } = this.gameData.ingame[realPlayer.profile.name] || { betTracks: {} };
        const roundHistory = await this.roundQuery.getList(maxNumberOfRounds);

        return {
            gameConfigs,
            roundHistory,
            remainingTime,
            ownBets,
            totalBets,
        };
    }
}
