import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { Systems } from "../../../constants/systems";
import BaseBot from "../../../core/crons/base-bot";
import { ProvablyFairConsumer } from "../../../core/event-consumers";
import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import GameManagementApiClientFactory from "../../../core/game-management-api";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableGameBot from "../table-game-bot";

jest.mock("sc-game-management-client");
jest.mock("sc-common");

describe("table game bot test", () => {
    const definition = new TableGameDefinition({ id: 1, name: "game name", durations: { lockingBet: 5 } });
    const gameData = new TableGameData(0);

    /** @type {BaseEventPublisher}*/
    const publisher = stub(BaseEventPublisher);

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongoose(mongoose.Model);

    const gameManagementApiClientFactory = new GameManagementApiClientFactory({});
    const provablyFairConsumer = stub(ProvablyFairConsumer);

    const tableBot = new TableGameBot(definition, gameData, publisher, gameManagementApiClientFactory, tempBetsRepository,provablyFairConsumer);

    afterEach(() => {
        jest.clearAllMocks();
    });
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
                tableBot.gameManagementApiClient.users.getDisableBots.mockReturnValueOnce({ isSuccessful: true, data: disabledBots });

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

        it("exist bot to place bet_calls place bets", async () => {
            // arrange
            const bots = [{ id: 1, name: "bot1", type: true, red: 2000 }];
            spyOn(tableBot, "getBotsToBet").and.returnValue(bots);
            spyOn(tableBot, "placeBets");

            // act
            await tableBot.run();

            // assert
            expect(tableBot.placeBets).toHaveBeenCalled();
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
            spyOn(publisher, "publishToAllUsers");

            // act
            tableBot.removeBot(1);

            // assert
            expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalledWith(Systems.Mobi, null, { outgame: { playerId: 1 } });
        });
    });

    describe("joinRoom and exist bot", () => {
        it("should calls botJoinRoom", async () => {
            // arrange
            spyOn(tableBot, "botJoinRoom");
            spyOn(tableBot, "getNumberOfBotsToJoin").and.returnValue(1);
            tableBot.gameManagementApiClient.users.getAllBots.mockReturnValueOnce({
                data: [{ id: 1, name: "bot1", type: true, red: 2000 }],
                isSuccessful: true,
            });

            // act
            await tableBot.joinRoom();

            // assert
            expect(tableBot.botJoinRoom).toHaveBeenCalled();
        });
    });

    describe("botJoinRoom", () => {
        it("should call publishToAllUsersExceptSystem", async () => {
            // arrange
            const bot = { id: 1, name: "bot1", type: true, red: 2000 };

            // act
            await tableBot.botJoinRoom(bot);

            // assert
            expect(publisher.publishToAllUsersExceptSystem).toHaveBeenCalled();
        });
    });

    describe("resetInRoomTrackings", () => {
        it("should calls update many user info", async () => {
            //act
            await tableBot.resetInRoomTrackings();

            // assert
            expect(tableBot.gameManagementApiClient.users.resetBotsInRoom).toHaveBeenCalled();
        });
    });
});
