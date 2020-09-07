import Chance from "chance";
import { userInfos } from "sc-base-database";
import { helpers } from "sc-common";

import { BaseBot } from "../../core";
import { BasePublisher } from "../../core/event-publishers";
import TableGameData from "../table-game-data";

export default class TableGameBot extends BaseBot {
    /**
     * @param {TableGameData} gameData
     * @param {BasePublisher} publisher
     */

    constructor(gameName, choices, durations, configName, tempBetRepository, gameData, publisher = null) {
        super(gameName, gameData, choices, publisher);
        this.durations = durations;
        this.configName = configName;
        this.tempBetRepository = tempBetRepository;
        this.inOutValues = {
            in: 3,
            out: 4,
        };

        this.removeBotAtTheTable = false;
        this.removeBotAtTheTableRoundFrequency = 6;
        this.chance = new Chance();
    }

    resetAllBotData() {
        super.resetAllBotData();
        this.removeBotAtTheTable = false;
    }

    async run() {
        if (this.gameData.gameConfigs?.botenabled && this.gameData.remainingTime > this.durations.lockingBet) {
            const random = this.chance.integer({ min: 0, max: 5 });
            if (this.shouldAddBot(random)) {
                await this.joinRoom();
            }

            if (this.shouldRemoveBot(random)) {
                await this.leaveRoom();
            }

            const botsToBet = this.getBotsToBet();

            for (let i = 0; i < botsToBet.length; i++) {
                let bot = botsToBet[i];

                await this.placeBet(bot);
            }
        }
    }

    shouldAddBot(random) {
        return random == this.inOutValues.in && Object.keys(this.botsInRoom).length <= this.maxNumberOfBots;
    }

    shouldRemoveBot(random) {
        return random == this.inOutValues.out && Object.keys(this.botsInRoom).length > 0;
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

    resetBot(bot) {
        bot.totalBet = 0;
        bot.choices = [];
        bot.betOnChoices = {};
        bot.remainTickets = this.getTicketsPerRound();
    }

    getTicketsPerRound() {
        return Math.floor(Math.random() * 3 + 2);
    }

    async joinRoom() {
        const botUsers = await userInfos.find({ type: true, inRoom: false, disabled: false }, "-_id id name red avatarId type").lean();
        const newBots = this.getBotsToJoin(botUsers);

        newBots.forEach(async (bot) => {
            await this.botJoinRoom(bot);
        });
    }

    getBotsToJoin(botUsers) {
        const maxBotRandom = this.maxNumberOfBots / this.gameData.remainingTime;
        const numberOfBotsToJoin = Math.floor(Math.random() * maxBotRandom + 1);
        const shuffleBots = this.chance.shuffle(botUsers);

        return shuffleBots.slice(0, numberOfBotsToJoin);
    }

    async botJoinRoom(bot) {
        await userInfos.updateOne({ id: bot.id }, { inRoom: true, inGameRoom: this.configName });

        this.resetBot(bot);

        this.botsInRoom[bot.id] = bot;
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

    async leaveRoom() {
        const maxBotRemoveRandom = Math.max(Object.values(this.botsInRoom).length / this.gameData.remainingTime, 4);
        const totalRemoval = this.chance.integer({ min: 1, max: Math.min(maxBotRemoveRandom, 1) });
        const removalIds = this.getRemovalBotIds(totalRemoval);

        removalIds.forEach(botId => {
            await this.removeBot(botId);
            delete this.botsInRoom[botId];
        });  
    }

    getRemovalBotIds(totalRemoval) {
        if (!this.removeBotAtTheTable && this.gameData.roundId % this.removeBotAtTheTableRoundFrequency == 0) {
            this.removeBotAtTheTable = true;

            return this.chance.pickset(Object.keys(this.botsInRoom), totalRemoval);
        }

        const shuffleBots = this.chance.shuffle(Object.keys(this.botsInRoom));

        return this.chance.pickset(shuffleBots, totalRemoval);
    }

    async placeBet(bot) {
        const choice = this.getBetChoice(bot);
        const maxBet = this.getMaxBet(bot, choice);
        const minBet = this.getMinBet();
        const amount = this.convertAmountToChip(helpers.numberHelper.getRandomNumberStep5(minBet, maxBet, true));

        if (this.gameData.remainingTime > this.durations.lockingBet) {
            const currentBet = await this.tempBetRepository.findOne({ uid: bot.id, phien: this.gameData.roundId }).lean();
            const totalBetAmount = this.getTotalBetAmount(currentBet);

            if (totalBetAmount + amount <= maxBet) {
                let user = await userInfos.findOne({ id: bot.id }, "red");
                if (user && user.red > amount) {
                    user.red -= amount;
                    await user.save();

                    await this.insertOrUpdateBet(bot, choice, amount, currentBet);

                    this.totalBets[choice] = this.totalBets[choice] ? this.totalBets[choice] + amount : amount;
                    this.totalTickets += 1;
                    if (this.gameData.players[bot.id]) {
                        this.gameData.players[bot.id].red = user.red;
                    }

                    this.gameData.totalBets[choice] = this.gameData.totalBets[choice] ? this.gameData.totalBets[choice] + amount : amount;

                    if (this.gameData.chips) {
                        this.gameData.chips[choice] = this.gameData.chips[choice] ?? {};
                        this.gameData.chips[choice][amount] = (this.gameData.chips[choice][amount] ?? 0) + 1;
                    }

                    this.updateBotInRoomData(bot, choice, amount, user.red);

                    this.publisher.publishToAllUsers(this.generatePlaceBetPayload(bot.id, choice, amount, user.red));
                }
            }
        }
    }

    getBetChoice(bot) {}

    getMaxBet(bot, choice) {}

    convertAmountToChip(amount) {
        return amount;
    }

    getMinBet() {
        return Math.max(1, this.gameData.gameConfigs.minbet);
    }

    getTotalBetAmount(bet) {
        let totalBet = 0;
        if (bet) {
            this.choices.forEach((choice) => {
                totalBet += bet[choice];
            });
        }

        return totalBet;
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

        let create = {
            uid: bot.id,
            name: bot.name,
            phien: this.gameData.roundId,
            time: new Date(),
        };

        await this.tempBetRepository.updateOne(
            { uid: bot.id, phien: this.gameData.roundId },
            { $inc: update, $setOnInsert: create },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    generatePlaceBetPayload(playerId, choice, amount, balance) {
        return {
            playerChip: { playerId, betChoice: choice, amount, red: balance },
        };
    }
}
