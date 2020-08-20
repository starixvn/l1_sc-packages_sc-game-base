import GameDefinition from "../game-definition";

export default class AdminMonitorConsumer {
    /**
     * @param {GameDefinition} definition
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient, definition, gameData) {
        const round = await definition.roundRepository
            .findOne({}, { id: true, result: true, settlementResult: true }, { sort: { id: -1 } })
            .lean()
            .exec();

        if (round) {
            const payload = {
                roundId: round.id + 1,
                result: round.result,
                settlementResult: round.settlementResult,
                remainingTime: gameData.remainingTime,
            };

            socketClient.emit("message", { [definition.name]: payload });
        }
    }
}
