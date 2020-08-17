import sortBy from "lodash.sortby";
import * as apis from "sc-base-apis";
import { logger } from "sc-common";

export default class InGameConsumer {
    constructor(publisher, storage, definition) {
        this.publisher = publisher ?? new BaseEventPublisher(storage, definition.name);
    }

    async checkInGame(definition, socketClient, gameData) {
        const realPlayer = gameData.realPlayers[socketClient.id];
        if (realPlayer) {
            await inGame(definition, realPlayer, gameData);
        } else {
            this.publisher.publishMessageBackToLobby(realPlayer.UID);
        }
    }

    async inGame(definition, realPlayer, gameData) {
        const maxNumberOfRounds = 100;
        const { minbet, maxbet, choices_maxbet, odds } = gameData.gameConfigs;
        const { remainingTime, totalBets } = gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds };

        await apis.getBalance(realPlayer, true);

        const [roundHistory, user] = await Promise.all([
            getRounds(definition.roundRepository, maxNumberOfRounds),
            getUserInfo(definition.userRepository, realPlayer.UID),
        ]);
        const { betTracks: ownBets } = gameData.ingame[realPlayer.profile.name] || { betTracks: {} };

        const player = {
            id: realPlayer.UID,
            name: realPlayer.profile.name,
            red: user.red,
            avatarId: user.avatarId,
            type: user.type,
        };

        const playerArr = Object.values(gameData.players);
        const sorted = sortBy(playerArr, "type");

        const players = {};
        sorted.forEach((item) => {
            players[item.id] = item;
        });

        delete players[realPlayer.UID];

        if (!gameData.players[player.id]) {
            gameData.players[player.id] = player;
        }

        const inGameData = {
            gameConfigs,
            roundHistory,
            remainingTime,
            ownBets,
            totalBets,
            players,
        };

        realPlayer.socketClient.emit(definition.name, inGameData);

        publisher.publishToAllUsersExcept(realPlayer.UID, { player });
    }

    async getRounds(roundRepository, limit, projections) {
        try {
            const rounds = await roundRepository
                .find({}, projections, { sort: { _id: -1 }, limit: limit })
                .lean()
                .exec();

            return rounds.map((round) => {
                const result = { red1: round.red1, red2: round.red2, red3: round.red3, red4: round.red4 };
                return {
                    roundId: round.id,
                    result: round.result ? convertResult() : round.result,
                    settlementResult: round.settlementResult ? convertToSettlementResult(result) : round.settlementResult,
                };
            });
        } catch (er) {
            console.log(er);
            logger.logError(er);
        }
    }

    async getUserInfo(userRepository, uid) {
        return await userRepository
            .findOne(
                { id: uid },
                { UID: true, name: true, avatarId: true, red: true, joinedOn: true, security: true, currency: true, type: true }
            )
            .lean()
            .exec();
    }

    convertSettlementResult(roundResult) {}

    convertResult(round) {}
}
