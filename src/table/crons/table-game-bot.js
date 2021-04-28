import Chance from "chance";
import mongoose from "mongoose";
import { helpers } from "sc-common";

import BaseBot from "./../../core/crons/base-bot";
import { BaseEventPublisher } from "./../../core/event-publishers";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableGameBot extends BaseBot {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {BaseEventPublisher} publisher
     * @param {mongoose.Model} userInfosRepository
     * @param {mongoose.Model} tempBetsRepository
     */
    constructor(definition, gameData, publisher, userInfosRepository, tempBetsRepository) {
        super(definition, gameData, userInfosRepository);

        this.publisher = publisher;
        this.tempBetsRepository = tempBetsRepository;
        this.inOutValues = {
            in: 3,
            out: 4,
        };

        this.removeBotAtTheTable = false;
        this.removeBotAtTheTableRoundFrequency = 6;
        this.chance = new Chance();
        this.minBotsAtTheTable = 8;
        this.botsInRoom = {};
    }

    async processDisabledBots() {
        const disabledBots = await this.userInfosRepository.find({ type: true, disabled: true }).lean().exec();

        await Promise.all(
            disabledBots.map(async (bot) => {
                if (this.botsInRoom[bot.id]) {
                    await this.removeBot(bot.id);
                    delete this.botsInRoom[bot.id];
                }
            })
        );
    }

    async removeBotsIfRatioChanged(totalRemoved) {
        const removedIds = this.chance.pickset(Object.keys(this.botsInRoom), totalRemoved);

        await Promise.all(
            removedIds.map(async (id) => {
                await this.removeBot(id);
                delete this.botsInRoom[id];
            })
        );
    }

    resetAllBotData() {
        super.resetAllBotData();
        this.removeBotAtTheTable = false;
        Object.keys(this.botsInRoom).forEach((id) => this.resetBot(this.botsInRoom[id]));
    }

    async run() {
        if (this.gameData.gameConfigs?.botenabled && this.gameData.remainingTime > this.definition.durations.lockingBet) {
            const random = this.chance.integer({ min: 0, max: 5 });

            if (this.shouldAddBot(random)) {
                await this.joinRoom();
            }

            if (this.shouldRemoveBot(random)) {
                await this.leaveRoom();
            }

            const botsToBet = this.getBotsToBet();

            await Promise.all(botsToBet.map((bot) => this.placeBet(bot)));
        }
    }

    shouldAddBot(random) {
        return random === this.inOutValues.in && Object.keys(this.botsInRoom).length <= this.maxNumberOfBots;
    }

    shouldRemoveBot(random) {
        const totalBots = Object.keys(this.botsInRoom).length;
        const numberBotsAtTable = Math.min(this.maxNumberOfBots, this.minBotsAtTheTable);

        return random === this.inOutValues.out && totalBots > numberBotsAtTable;
    }

    getBotsToBet() {
        const maxTickets = Math.floor(Object.keys(this.botsInRoom).length / this.gameData.remainingTime) + 5;
        const numberBotsToBet = this.chance.integer({ min: 5, max: maxTickets });

        let botsToBet = Object.values(this.botsInRoom).filter(
            (t) => t.totalBet < this.gameData.gameConfigs.bot_maxbet && t.remainTickets > 0
        );

        botsToBet = this.chance.shuffle(botsToBet);

        return botsToBet.slice(0, Math.min(numberBotsToBet, botsToBet.length - 1));
    }

    async removeAllBots() {
        const bots = Object.values(this.gameData.players).filter((player) => player.type);

        await Promise.all(bots.map((bot) => this.removeBot(bot.id)));

        this.botsInRoom = {};
        this.maxNumberOfBots = 0;
        this.currentBotRatio = 0;
    }

    async removeBot(botId) {
        await this.userInfosRepository.updateOne({ id: botId }, { inRoom: false, inGameRoom: "", patternId: 0 });

        this.publisher.publishToAllUsers({ outgame: { playerId: botId } });

        delete this.gameData.players[botId];
    }

    resetBot(bot) {
        bot.totalBet = 0;
        bot.choices = [];
        bot.betOnChoices = {};
        bot.remainTickets = this.getTicketsPerRound();
    }

    getTicketsPerRound() {
        return this.chance.integer({ min: 2, max: 5 });
    }

    async joinRoom() {
        const botUsers = await this.userInfosRepository
            .find({ type: true, inRoom: false, disabled: false }, "-_id id name red avatarId type")
            .lean();
        const newBots = this.getBotsToJoin(botUsers);

        await Promise.all(newBots.map((bot) => this.botJoinRoom(bot)));
    }

    getBotsToJoin(botUsers) {
        const remaining = this.maxNumberOfBots - Object.keys(this.botsInRoom).length;
        const maxBotRandom =
            remaining > 0
                ? Math.min(Math.max(1, this.maxNumberOfBots / this.gameData.remainingTime), remaining)
                : Math.max(1, this.maxNumberOfBots / this.gameData.remainingTime);
        const numberOfBotsToJoin = this.chance.integer({ min: 1, max: maxBotRandom });
        const shuffleBots = this.chance.shuffle(botUsers);

        return shuffleBots.slice(0, numberOfBotsToJoin);
    }

    async botJoinRoom(bot) {
        await this.userInfosRepository.updateOne({ id: bot.id }, { inRoom: true, inGameRoom: this.definition.configName });

        this.resetBot(bot);
        this.botsInRoom[bot.id] = bot;

        this.addToPlayersAndPublish(bot);
    }

    addToPlayersAndPublish(bot) {
        this.gameData.players[bot.id] = bot;
        const payload = {
            player: {
                id: bot.id,
                name: bot.name,
                red: bot.red,
                avatarId: bot.avatarId,
                type: bot.type,
            },
        };
        this.publisher.publishToAllUsers(payload);
    }

    async resetInRoomTrackings() {
        await this.userInfosRepository.updateMany(
            { type: true, inGameRoom: this.definition.configName },
            { inRoom: false, inGameRoom: "" }
        );
    }

    async leaveRoom() {
        const maxBotRemoveRandom = Math.max(Object.values(this.botsInRoom).length / this.gameData.remainingTime, 4);
        const totalRemoval = this.chance.integer({ min: 1, max: Math.max(maxBotRemoveRandom, 1) });
        const removalIds = this.getRemovalBotIds(totalRemoval);

        await Promise.all(
            removalIds.map(async (botId) => {
                await this.removeBot(botId);
                delete this.botsInRoom[botId];
            })
        );
    }

    getRemovalBotIds(totalRemoval) {
        const botIds = Object.keys(this.botsInRoom);
        if (!this.removeBotAtTheTable && this.gameData.roundId % this.removeBotAtTheTableRoundFrequency === 0) {
            this.removeBotAtTheTable = true;

            const botsOnTable = botIds?.length > 8 ? botIds.slice(0, 8) : botIds;

            return botsOnTable?.length > 3 ? this.chance.pickset(botsOnTable, this.chance.integer({ min: 1, max: 3 })) : botsOnTable;
        }

        return botIds?.length > totalRemoval ? this.chance.pickset(Object.keys(this.botsInRoom), totalRemoval) : botIds;
    }

    async placeBet(bot) {
        const choice = this.getBetChoice(bot);
        const maxBet = this.getMaxBet(bot, choice);
        const minBet = this.getMinBet();
        const amount = this.convertAmountToChip(helpers.numberHelper.getRandomNumberStep5(minBet, maxBet, true));

        if (this.gameData.remainingTime > this.definition.durations.lockingBet) {
            const currentBet = await this.tempBetsRepository.findOne({ uid: bot.id, phien: this.gameData.roundId }).lean().exec();
            const totalBetAmount = this.getTotalBetAmount(currentBet);

            if (totalBetAmount + amount <= this.gameData.gameConfigs.bot_maxbet) {
                const user = await this.userInfosRepository
                    .findOneAndUpdate({ id: bot.id, red: { $gt: amount } }, { $inc: { red: -amount } }, { new: true })
                    .lean();

                if (user) {
                    await this.insertOrUpdateBet(bot, choice, amount, currentBet);

                    this.totalTickets += 1;

                    this.updateTotalBetsAndChips(choice, amount);
                    this.updateBotInRoomData(bot, choice, amount, user.red);
                    this.updateBalanceAndPublishBetPayload(bot.id, choice, amount, user.red);
                }
            }
        }
    }

    convertAmountToChip(amount) {
        return amount;
    }

    updateBalanceAndPublishBetPayload(botId, choice, amount, balance) {
        if (this.gameData.players[botId]) {
            this.gameData.players[botId].red = balance;
        }

        this.publisher.publishToAllUsers(this.generatePlaceBetPayload(botId, choice, amount, balance));
    }

    updateTotalBetsAndChips(choice, amount) {
        this.gameData.totalBets[choice] = this.gameData.totalBets[choice] ? this.gameData.totalBets[choice] + amount : amount;

        if (this.gameData.chips) {
            this.gameData.chips[choice] = this.gameData.chips[choice] ?? {};
            this.gameData.chips[choice][amount] = (this.gameData.chips[choice][amount] ?? 0) + 1;
        }
    }

    updateBotInRoomData(bot, choice, amount, balance) {
        bot.totalBet += amount;
        bot.choices.push(choice);
        bot.red = balance;
        bot.remainTickets--;
        bot.betOnChoices[choice] += amount;
    }

    async insertOrUpdateBet(bot, choice, amount, currentBet) {
        const currentAmount = currentBet ? currentBet[choice] : 0;
        const update = { [choice]: amount + currentAmount };
        const create = {
            uid: bot.id,
            name: bot.name,
            phien: this.gameData.roundId,
            time: new Date(),
        };

        await this.tempBetsRepository.updateOne(
            { uid: bot.id, phien: this.gameData.roundId },
            { $set: update, $setOnInsert: create },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    generatePlaceBetPayload(playerId, choice, amount, balance) {
        return {
            playerChip: { playerId, betChoice: choice, amount, red: balance },
        };
    }
}
