import { getBalance } from "sc-base-apis";
import { userInfos } from "sc-base-database";

import { BaseEventPublishers, QueryApis } from "./../../core";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class InGameConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {QueryApis.RoundQuery} roundQuery
     * @param {BaseEventPublishers.BasePublisher} publisher
     */
    constructor(definition, gameData, roundQuery = null, publisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.roundQuery = roundQuery ?? new QueryApis.RoundQuery(definition);
        this.publisher = publisher ?? new BaseEventPublishers.BasePublisher(definition.name, gameData);
    }

    /**
     * @param {SocketIO.Client} socketClient
     */
    async consume(socketClient) {
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

        const [roundHistory, user] = await Promise.all([this.roundQuery.getList(maxNumberOfRounds), this.getUserInfo(realPlayer.UID)]);
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

    getUserInfo(uid) {
        return userInfos
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
