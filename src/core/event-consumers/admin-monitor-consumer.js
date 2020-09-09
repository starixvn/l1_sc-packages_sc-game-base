import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class AdminMonitorConsumer {
    /**
     * @param {SocketIO.Socket} socketClient
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     */
    async consume(socketClient, definition, gameData) {
        const lastRound = await definition.roundRepository
            .findOne({}, { id: true, result: true, settlementResult: true }, { sort: { id: -1 } })
            .lean()
            .exec();

        if (lastRound) {
            const payload = {
                roundId: lastRound.id + 1,
                result: lastRound.result,
                settlementResult: lastRound.settlementResult,
                remainingTime: gameData.remainingTime,
            };

            socketClient.emit("message", { [definition.name]: payload });
        }
    }
}
