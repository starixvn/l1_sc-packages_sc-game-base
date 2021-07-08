import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { Systems } from "../../../constants/systems";
import BaseBot from "../../../core/crons/base-bot";
import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableGameBot from "../table-game-bot";

describe("table game bot test", () => {
    const definition = new TableGameDefinition({ id: 1, name: "game name", durations: { lockingBet: 5 } });
    const gameData = new TableGameData(0);

    /** @type {BaseEventPublisher}*/
    const publisher = stub(BaseEventPublisher);

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongooseModelStupidly(mongoose.Model);

    const tableBot = new TableGameBot(definition, gameData, publisher, userInfosRepository, tempBetsRepository);

    it("inherit base bot", () => {
        expect(tableBot instanceof BaseBot);
    });

    it("generatePlaceBetPayload_always_returns correct result", () => {
        // arrange
        const playerId = "player-id";
        const choice = "choice";
        const amount = 200;
        const balance = 10000;
        const expectedResult = { playerChip: { playerId, betChoice: choice, amount, red: balance } };

        // act & assert
        expect(tableBot.generatePlaceBetPayload(playerId, choice, amount, balance)).toEqual(expectedResult);
    });

    it("insertOrUpdateBet_always_calls update temp bet", async () => {
        // arrange
        const bot = { id: 1, name: "bot1", type: true, red: 20000 };
        const choice = "odd";
        const amount = 100;

        // act
        await tableBot.insertOrUpdateBet(bot, choice, amount, null);

        // assert
        expect(tempBetsRepository.updateOne).toHaveBeenCalled();
    });

    it("processDisabledBots_exist disabled bot_remove bot", async () => {
        // arrange
        const disabledBots = [{ id: 1, name: "bot1", type: true }];
        userInfosRepository.find().lean().exec.mockReturnValue(disabledBots);

        spyOn(tableBot, "removeBot");
        tableBot.botsInRoom[1] = { id: 1, name: "bot1", type: true };

        // act
        await tableBot.processDisabledBots();

        // assert
        expect(tableBot.removeBot).toHaveBeenCalledWith(1);
    });

    it("removeBotsIfRatioChanged_ratioChanged_remove bot", async () => {
        // arrange
        spyOn(tableBot.chance, "pickset").and.returnValue([1]);
        spyOn(tableBot, "removeBot");

        // act
        await tableBot.removeBotsIfRatioChanged(1);

        // assert
        expect(tableBot.removeBot).toHaveBeenCalledWith(1);
    });

    it("resetAllBotData", () => {
        // arrange
        spyOn(BaseBot.prototype, "resetAllBotData");
        tableBot.botsInRoom = [{ id: 1, totalBet: 1000 }];

        // act
        tableBot.resetAllBotData();

        // assert
        expect(BaseBot.prototype.resetAllBotData).toHaveBeenCalled();
    });

    describe("run_botenabled and remaining time greater than locking bet time", () => {
        beforeEach(() => {
            gameData.remainingTime = 10;
            gameData.gameConfigs = { botenabled: true };
            spyOn(tableBot, "joinRoom");
            spyOn(tableBot, "leaveRoom");
        });

        it("_should add bot_call join room", async () => {
            // arrange
            spyOn(tableBot, "shouldAddBot").and.returnValue(true);

            // act
            await tableBot.run();

            expect(tableBot.joinRoom).toHaveBeenCalled();
        });

        it("_should remove bot_call leave room", async () => {
            // arrange
            spyOn(tableBot, "shouldRemoveBot").and.returnValue(true);

            // act
            await tableBot.run();

            // assert
            expect(tableBot.leaveRoom).toHaveBeenCalled();
        });

        it("_exist bot to place bet_calls place bet", async () => {
            // arrange
            const bots = [{ id: 1, name: "bot1", type: true, red: 2000 }];
            spyOn(tableBot, "getBotsToBet").and.returnValue(bots);
            spyOn(tableBot, "placeBet");

            // act
            await tableBot.run();

            // assert
            expect(tableBot.placeBet).toHaveBeenCalled();
        });
    });

    it("removeAllBots_exist bots in game_call remove bot", async () => {
        // arrange
        gameData.players = [{ id: 1, name: "bot1", red: 1000, type: true }];
        spyOn(tableBot, "removeBot");

        // act
        await tableBot.removeAllBots();

        // assert
        expect(tableBot.removeBot).toHaveBeenCalled();
    });

    it("removeBot_always_call specific methods", async () => {
        // arrange
        spyOn(userInfosRepository, "updateOne");
        spyOn(publisher, "publishToAllUsers");

        // act
        await tableBot.removeBot(1);

        // assert
        expect(userInfosRepository.updateOne).toHaveBeenCalledWith({ id: 1 }, { inRoom: false, inGameRoom: "", patternId: 0 });
        expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalledWith(Systems.Mobi, null, { outgame: { playerId: 1 } });
    });

    it("joinRoom_exist bot_calls botJoinRoom", async () => {
        // arrange
        spyOn(tableBot, "getBotsToJoin").and.returnValue([{ id: 1, name: "bot1", type: true, red: 2000 }]);
        spyOn(tableBot, "botJoinRoom");
        spyOn(userInfosRepository, "find").and.callFake(() => {
            return {
                exec: () => {},
            };
        });

        // act
        await tableBot.joinRoom();

        // assert
        expect(tableBot.botJoinRoom).toHaveBeenCalled();
    });

    it("botJoinRoom_always_update inRoom", async () => {
        // arrange
        const bot = { id: 1, name: "bot1", type: true, red: 2000 };
        spyOn(userInfosRepository, "updateOne");

        // act
        await tableBot.botJoinRoom(bot);

        // assert
        expect(userInfosRepository.updateOne).toHaveBeenCalled();
        expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalled();
    });

    it("resetInRoomTrackings_always_calls update many user info", async () => {
        // arrange
        spyOn(userInfosRepository, "updateMany");

        //act
        await tableBot.resetInRoomTrackings();

        // assert
        expect(userInfosRepository.updateMany).toHaveBeenCalled();
    });

    it("placeBet_meet condition_calls specific methods", async () => {
        // arrange
        const bot = { id: 1, name: "bot1", type: true, red: 2000, save: jest.fn(), choices: [], betOnChoices: {} };
        spyOn(bot, "save");
        const choice = "odd";
        const maxBet = 5000;
        const minBet = 10;
        const amount = 100;
        spyOn(tableBot, "getBetChoice").and.returnValue(choice);
        spyOn(tableBot, "getMaxBet").and.returnValue(maxBet);
        spyOn(tableBot, "getMinBet").and.returnValue(minBet);
        spyOn(tableBot, "convertAmountToChip").and.returnValue(amount);
        gameData.remainingTime = 10;
        gameData.gameConfigs = { bot_maxbet: 5000 };
        tempBetsRepository.findOne().lean().exec.mockReturnValue(null);
        spyOn(userInfosRepository, "findOne").and.callFake(() => {
            return {
                exec: () => {
                    return bot;
                },
            };
        });

        spyOn(tableBot, "insertOrUpdateBet");

        // act
        await tableBot.placeBet(bot);

        // assert
        expect(tableBot.insertOrUpdateBet).toHaveBeenCalled();
    });
});
