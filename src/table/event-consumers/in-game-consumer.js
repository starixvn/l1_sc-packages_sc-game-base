import sortBy from "lodash.sortby";
import * as apis from "sc-base-apis";
import { TableBasePublisher } from "./../event-publishers";
import TableGameDefinition from "../table-game-definition";
import { userInfos } from "sc-base-database";

export default class InGameConsumer {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableBaseEventPublisher} publisher
     */
    constructor(definition, gameData, publisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher ?? new TableBasePublisher(definition.name, gameData);
    }

    async checkInGame(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];
        if (realPlayer) {
            await this.inGame(realPlayer);
        } else {
            this.publisher.publishMessageBackToLobby(realPlayer.UID);
        }
    }

    async inGame(realPlayer) {
        const maxNumberOfRounds = 100;
        const { minbet, maxbet, choices_maxbet, odds } = this.gameData.gameConfigs;
        const { remainingTime, totalBets } = this.gameData;
        const gameConfigs = { minbet, maxbet, choices_maxbet, odds };

        await apis.getBalance(realPlayer, true);

        const [roundHistory, user] = await Promise.all([
            this.getRounds(this.definition.roundRepository, maxNumberOfRounds),
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

        const playerArr = Object.values(this.gameData.players);
        const sorted = sortBy(playerArr, "type");

        const players = {};
        sorted.forEach((item) => {
            players[item.id] = item;
        });

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
                { UID: true, name: true, avatarId: true, red: true, joinedOn: true, security: true, currency: true, type: true }
            )
            .lean()
            .exec();
    }

    convertSettlementResult(roundResult) {}

    convertResult(round) {}
}
