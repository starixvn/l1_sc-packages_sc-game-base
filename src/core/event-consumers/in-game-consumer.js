import { BasePublisher } from "../event-consumers";
import { RoundQuery } from "../query-apis";

export default class InGameConsumer {
    constructor({ gameDefinition, gameData, roundQuery, publisher }) {
        this.definition = gameDefinition;
        this.gameData = gameData;
        this.roundQuery = roundQuery ?? new RoundQuery(gameDefinition);
        this.publisher = publisher ?? new BasePublisher(gameDefinition.name, gameData);
    }

    /**
     * @param {SocketIO.Client} socketClient
     */
    async consume(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        if (!realPlayer) {
            return;
        }

        const payload = await this.buildPayload();
        realPlayer.socketClient.emit(this.definition.name, payload);
    }

    async buildPayload() {
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
