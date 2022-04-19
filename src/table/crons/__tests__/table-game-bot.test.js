import { stub, stubMongoose } from "jest-micro-auto-stub";
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
    const userInfosRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongoose(mongoose.Model);

    const tableBot = new TableGameBot(definition, gameData, publisher, userInfosRepository, tempBetsRepository);

    it("inherit base bot", () => {
        expect(tableBot instanceof BaseBot);
    });

    describe("generatePlaceBetPayload", () => {
        it("should returns correct result", () => {
            // arrange
            const playerId = "player-id";
            const choice = "choice";
            const amount = 200;
            const balance = 10000;
            const expectedResult = { playerChip: { playerId, betChoice: choice, amount, red: balance } };

            // act & assert
            expect(tableBot.generatePlaceBetPayload(playerId, choice, amount, balance)).toEqual(expectedResult);
        });
    });

    describe("insertOrUpdateBet", () => {
        it("should calls update temp bet", async () => {
            // arrange
            const bot = { id: 1, name: "bot1", type: true, red: 20000 };
            const choice = "odd";
            const amount = 100;

            // act
            await tableBot.insertOrUpdateBet(bot, choice, amount, null);

            // assert
            expect(tempBetsRepository.updateOne).toHaveBeenCalled();
        });
    });

    describe("processDisabledBots", () => {
        describe("when exist disabled bot", () => {
            it("should remove bot", async () => {
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
        });
    });

    describe("removeBotsIfRatioChanged and ratioChanged", () => {
        it("should remove bot", async () => {
            // arrange
            spyOn(tableBot.chance, "pickset").and.returnValue([1]);
            spyOn(tableBot, "removeBot");

            // act
            await tableBot.removeBotsIfRatioChanged(1);

            // assert
            expect(tableBot.removeBot).toHaveBeenCalledWith(1);
        });
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

        it("should add bot_call join room", async () => {
            // arrange
            spyOn(tableBot, "shouldAddBot").and.returnValue(true);

            // act
            await tableBot.run();

            expect(tableBot.joinRoom).toHaveBeenCalled();
        });

        it("should remove bot_call leave room", async () => {
            // arrange
            spyOn(tableBot, "shouldRemoveBot").and.returnValue(true);

            // act
            await tableBot.run();

            // assert
            expect(tableBot.leaveRoom).toHaveBeenCalled();
        });

        it("exist bot to place bet_calls place bet", async () => {
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

    describe("removeAllBots and exist bots in game", () => {
        it("should call remove bot", async () => {
            // arrange
            gameData.players = [{ id: 1, name: "bot1", red: 1000, type: true }];
            spyOn(tableBot, "removeBot");

            // act
            await tableBot.removeAllBots();

            // assert
            expect(tableBot.removeBot).toHaveBeenCalled();
        });
    });

    describe("removeBot", () => {
        it("should call specific methods", async () => {
            // arrange
            spyOn(userInfosRepository, "updateOne");
            spyOn(publisher, "publishToAllUsers");

            // act
            await tableBot.removeBot(1);

            // assert
            expect(userInfosRepository.updateOne).toHaveBeenCalledWith({ id: 1 }, { inRoom: false, inGameRoom: "", patternId: 0 });
            expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalledWith(Systems.Mobi, null, { outgame: { playerId: 1 } });
        });
    });

    describe("joinRoom and exist bot", () => {
        it("should calls botJoinRoom", async () => {
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
    });

    describe("botJoinRoom", () => {
        it("should call updateOne", async () => {
            // arrange
            const bot = { id: 1, name: "bot1", type: true, red: 2000 };
            spyOn(userInfosRepository, "updateOne");

            // act
            await tableBot.botJoinRoom(bot);

            // assert
            expect(userInfosRepository.updateOne).toHaveBeenCalled();
        });

        it("should call publishToAllUsersExceptSystem", async () => {
            // arrange
            const bot = { id: 1, name: "bot1", type: true, red: 2000 };
            spyOn(userInfosRepository, "updateOne");

            // act
            await tableBot.botJoinRoom(bot);

            // assert
            expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalled();
        });
    });

    describe("resetInRoomTrackings", () => {
        it("should calls update many user info", async () => {
            // arrange
            spyOn(userInfosRepository, "updateMany");

            //act
            await tableBot.resetInRoomTrackings();

            // assert
            expect(userInfosRepository.updateMany).toHaveBeenCalled();
        });
    });

    describe("placeBet and meet condition", () => {
        it("should calls specific methods", async () => {
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
            userInfosRepository.findOneAndUpdate.mockReturnValueOnce(bot);

            spyOn(tableBot, "insertOrUpdateBet");

            // act
            await tableBot.placeBet(bot);

            // assert
            expect(tableBot.insertOrUpdateBet).toHaveBeenCalled();
        });
    });
});
