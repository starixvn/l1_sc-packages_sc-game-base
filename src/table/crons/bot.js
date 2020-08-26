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
    }

    async run() {
        if (this.gameData.gameConfigs?.botenabled && this.gameData.remainingTime > this.durations.lockingBet) {
            const random = (Math.random() * 5) >> 0;
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
        return random == this.inOutValues.out;
    }

    getBotsToBet() {
        const maxTickets = Math.floor(Object.keys(this.botsInRoom).length / this.gameData.remainingTime) + 5;
        const numberBotsToBet = Math.floor(Math.random() * maxTickets + 5);

        let botsToBet = Object.values(this.botsInRoom).filter(
            (t) => t.totalBet < this.gameData.gameConfigs.bot_maxbet && t.remainTickets > 0
        );
        botsToBet = helpers.arrayHelper.shuffle(botsToBet);

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

        const length = this.getNumberOfBotsToJoin();

        let botList = helpers.arrayHelper.shuffle(botUsers);
        botList = botList.slice(0, length);

        for (let i = 0; i < botList.length; i++) {
            let bot = botList[i];

            if (!!bot) {
                await this.botJoinRoom(bot);
            }
        }
    }

    getNumberOfBotsToJoin() {
        const maxBotRandom = this.maxNumberOfBots / this.gameData.remainingTime;

        return Math.floor(Math.random() * maxBotRandom + 1);
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

    async placeBet(bot) {
        const choice = this.getBetChoice(bot);
        const maxBet = this.getMaxBet(bot, choice);
        const minBet = this.getMinBet();
        const amount = this.convertAmountToChip(helpers.numberHelper.getRandomNumberStep5(minBet, maxBet, true));

        if (this.gameData.remainingTime > this.durations.lockingBet) {
            const currentBet = await this.tempBetRepository.findOne({ uid: bot.id, phien: this.gameData.roundId, red: true }).lean();
            const totalBetAmount = this.getTotalBetAmount(currentBet);

            if (totalBetAmount + amount <= maxBet) {
                userInfos.findOneAndUpdate();
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
            red: true,
            time: new Date(),
        };

        await this.tempBetRepository.updateOne(
            { uid: bot.id, phien: this.gameData.roundId, red: true },
            { $inc: update, $setOnInsert: create },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }
}
