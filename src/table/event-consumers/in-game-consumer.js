import { getBalance } from "sc-base-apis";
import { userInfos } from "sc-base-database";

import { BaseEventPublishers } from "./../../core";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class InGameConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     */
    constructor(definition, gameData) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = new BaseEventPublishers.BasePublisher(definition.name, gameData);
    }

    convertSettlementResult(roundResult) {}

    convertResult(round) {}

    /**
     * @param {SocketIO.Client} socketClient
     */
    async inGame(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        if (!realPlayer) {
            return;
        }

        const maxNumberOfRounds = 100;
        const { minbet, maxbet, choices_maxbet, odds } = this.gameData.gameConfigs;
        const { remainingTime, totalBets, chips } = this.gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds };
        const { betTracks: ownBets } = this.gameData.ingame[realPlayer.profile.name] || { betTracks: {} };

        await getBalance(realPlayer, true);

        const [roundHistory, user] = await Promise.all([
            this.getRounds(this.definition.roundRepository, maxNumberOfRounds),
            this.getUserInfo(realPlayer.UID),
        ]);
        const players = { ...this.gameData.players };
        const player = {
            id: realPlayer.UID,
            name: realPlayer.profile.name,
            red: user.red,
            avatarId: user.avatarId,
            type: user.type,
        };

        delete players[realPlayer.UID];

        if (!this.gameData.players[player.id]) {
            this.gameData.players[player.id] = player;
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

        realPlayer.socketClient.emit(this.definition.name, inGameData);
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
                {
                    UID: true,
                    name: true,
                    avatarId: true,
                    red: true,
                    joinedOn: true,
                    security: true,
                    currency: true,
                    type: true,
                }
            )
            .lean()
            .exec();
    }
}
