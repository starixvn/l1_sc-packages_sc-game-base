import { helpers } from "sc-common";
import { userInfos } from "sc-base-database";

import { BasePublisher } from "../event-publishers";
import GameData from "../game-data";
import GameDefinition from "../game-definition";

export default class BaseBot {
    /**
     * @param {GameData} gameData
     * @param {GameDefinition} definition
     * @param {BasePublisher} publisher
     */

    constructor(definition, gameData, publisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher ?? new BasePublisher(definition.name, gameData);

        this.currentBotRatio = 0;
        this.maxNumberOfBots = 0;
        this.botsInRoom = [];
        this.totalTickets = 0;
        this.totalSmallTickets = 0;
        this.totalBets = {};
    }

    async resetBots() {
        const configs = this.gameData.gameConfigs;
        if (configs.botenabled) {
            const botRatio = helpers.configHelper.getMaxBotForCurrentHour(configs);
            if (this.currentBotRatio != botRatio) {
                this.currentBotRatio = botRatio;

                const bots = await userInfos.find({ type: true }).lean();
                this.maxNumberOfBots = Math.floor(bots.length * this.currentBotRatio);

                const disabledBots = bots.filter((bot) => bot.disabled);
                disabledBots.forEach((bot) => this.removeBot(bot.id));
            }

            // changedTopBots = false;
        } else {
            await this.removeAllBots();
        }

        this.resetBotData();
    }

    async removeAllBots() {
        const bots = Object.values(this.gameData.players).filter((player) => player.type);

        bots.forEach(async (bot) => await removeBot(bot.id));

        this.botsInRoom = [];
        this.maxNumberOfBots = 0;
        this.currentBotRatio = 0;
    }

    async removeBot(botId) {
        await userInfos.updateOne({ id: botId }, { inRoom: false, inGameRoom: "" });

        this.publisher.publishToAllUsers({ outgame: { playerId: botId } });

        delete this.gameData.players[botId];
    }

    resetBotData() {
        Object.keys(botsInRoom).forEach((id) => this.resetBot(botsInRoom[id]));

        this.totalTickets = 0;
        this.totalSmallTickets = 0;
        this.totalBets = {};
    }

    resetBot(bot) {
        if (!!bot) {
            bot.totalBet = 0;
            bot.remainTickets = getTicketsPerRound();
            bot.choices = [];
            bot.betOnChoices = {};
        }
    }

    getTicketsPerRound() {
        return Math.floor(Math.random() * 3 + 2);
    }

    async joinRoom() {
        const botUsers = await userInfos.find({ type: true, inRoom: false, disabled: false }, "-_id id name red avatarId type");

        const length = this.getNumberOfBotsToJoin();

        let botList = helpers.arrayHelper.shuffle(botUsers);
        botList = botList.slice(0, length);

        for (let i = 0; i < botList.length; i++) {
            let bot = botList[i];

            if (!!bot) {
                await botJoinRoom(bot);
            }
        }
    }

    getNumberOfBotsToJoin() {
        const maxBotRandom = maxNumberOfBots / this.gameData.remainingTime;

        return Math.floor(Math.random() * maxBotRandom + 1);
    }

    async botJoinRoom(bot) {
        await userInfos.updateOne({ id: bot.id }, { inRoom: true, inGameRoom: this.definition.configName });

        this.resetBot(bot);
        botList.splice(i, 1);

        this.botsInRoom[bot.id] = bot;
        this.gameData.players[bot.id] = bot;

        const payload = {
            ingame: {
                player: {
                    id: bot.id,
                    name: bot.name,
                    red: bot.red,
                    avatarId: bot.avatarId,
                    type: bot.type,
                },
            },
        };

        this.publisher.publishToAllUsers(payload);
    }

    async leaveRoom() {
        const activeBots = Object.values(this.botsInRoom).length;
        const maxBotRemoveRandom = Math.min(activeBots.length / this.gameData.remainingTime, 4);

        const totalBots = (Math.random() * maxBotRemoveRandom) >> 0;

        for (let i = 0; i < totalBots; i++) {
            let index = (Math.random() * totalBots) >> 0;

            // if (!changedTopBots && roundId % modRoundToChangedTopBot == 0) {
            //     // change top of bots
            //     index = (Math.random() * 8) >> 0;
            //     changedTopBots = true;
            // }

            let playerId = activeBots[index];

            await this.removeBot(playerId);
            this.botsInRoom.slice(playerId, 1);
        }
    }
}
