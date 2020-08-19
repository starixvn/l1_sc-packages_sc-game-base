import sortBy from "lodash.sortby";
import { getBalance } from "sc-base-apis";

import TableGameData from "../table-game-data.js";
import { userInfos } from "sc-base-database";

import TableGameDefinition from "../table-game-definition";

export default class InGameConsumer {
    /**
     * @param {SocketIO.Client} socketClient
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     */
    async inGame(socketClient, definition, gameData) {
        const realPlayer = gameData.realPlayers[socketClient.id];

        if (!realPlayer) {
            return;
        }

        const maxNumberOfRounds = 100;
        const { minbet, maxbet, choices_maxbet, odds } = gameData.gameConfigs;
        const { remainingTime, totalBets, chips } = gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds };

        await getBalance(realPlayer, true);

        const [roundHistory, user] = await Promise.all([
            this.getRounds(definition.roundRepository, maxNumberOfRounds),
            this.getUserInfo(realPlayer.UID),
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
            chips,
        };

        realPlayer.socketClient.emit(definition.name, inGameData);

        this.publisher.publishToAllUsersExcept(realPlayer.UID, { player });
    }

    async getRounds(roundRepository, limit, projections) {
        const rounds = await roundRepository
            .find({}, projections, { sort: { _id: -1 }, limit: limit })
            .lean()
            .exec();

        return rounds.map((round) => {
            const result = round.result ?? this.convertResult(round);
            return {
                roundId: round.id,
                result: result,
                settlementResult: round.settlementResult ?? this.convertSettlementResult(result),
            };
        });
    }

    async getUserInfo(uid) {
        return await userInfos
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
