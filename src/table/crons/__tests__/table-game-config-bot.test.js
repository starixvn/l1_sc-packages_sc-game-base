import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { helpers } from "sc-common";

import BaseEventPublisher from "../../../core/event-publishers/base-event-publisher";
import GameManagementApiClientFactory from "../../../core/game-management-api";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableGameBot from "../table-game-bot";
import TableGameConfigBot from "../table-game-config-bot";

jest.mock("sc-game-management-client");
jest.mock("sc-common");

describe("table game config bot test", () => {
    const definition = new TableGameDefinition({
        id: 1,
        name: "game name",
    });
    const gameData = new TableGameData(0);

    /** @type {BaseEventPublisher}*/
    const publisher = stub(BaseEventPublisher);

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongoose(mongoose.Model);

    const gameManagementApiClientFactory = new GameManagementApiClientFactory({});
    
    /** @type {TableGameConfigBot}*/
    let bot;
    beforeEach(() => {
        bot = new TableGameConfigBot(definition, gameData, publisher, gameManagementApiClientFactory, tempBetsRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("inherit base bot", () => {
        expect(bot instanceof TableGameBot);
    });

    describe("resetAllBotData", () => {
        it("should reset all bets", async () => {
            // arrange
            spyOn(TableGameBot.prototype, "resetAllBotData");
            bot.betOptions = ["choice1", "choice2", "choice3"];
            bot.allBets = {
                choice1: 10,
                choice2: 20,
                choice3: 50,
            };
            bot.smallTickets = 10;

            // act
            bot.resetAllBotData();

            // assert
            expect(bot.allBets).toEqual({ choice1: 0, choice2: 0, choice3: 0 });
            expect(bot.smallTickets).toEqual(0);
        });
    });

    describe("getBetChoice", () => {
        beforeEach(() => {
            bot.chance = {
                pickone: jest.fn(),
            };
            helpers.arrayHelper = { shuffle: jest.fn() };
        });
        describe("when hedgeBetGroup not include choice", () => {
            beforeEach(() => {
                bot.betOptions = ["choice3", "choice4"];
                bot.hedgeBetGroups = [];
                helpers.arrayHelper = { shuffle: jest.fn() };
            });
            describe("when getBetChoicesRatios return any group with underBetRatio = true", () => {
                it("should return one choice in group", () => {
                    // arrange
                    const betChoiceRatios = [{ underBetRatio: true, group: ["choice1", "choice2"] }];
                    bot.getBetChoicesRatios = jest.fn().mockReturnValue(betChoiceRatios);
                    helpers.arrayHelper.shuffle.mockReturnValue(betChoiceRatios);
                    bot.chance.pickone.mockReturnValueOnce(betChoiceRatios[0].group[0]);

                    // act
                    const actual = bot.getBetChoice({});

                    // assert
                    expect(bot.chance.pickone).toHaveBeenCalledWith(betChoiceRatios[0].group);
                    expect(actual).toBe(betChoiceRatios[0].group[0]);
                });
            });

            describe("when getBetChoicesRatios not return any group with underBetRatio = true", () => {
                it("should return one choice in betOptions", () => {
                    // arrange
                    const betChoiceRatios = [{ underBetRatio: false, group: ["choice1", "choice2"] }];
                    bot.getBetChoicesRatios = jest.fn().mockReturnValue(betChoiceRatios);
                    helpers.arrayHelper.shuffle.mockReturnValue([]);
                    bot.chance.pickone.mockReturnValueOnce("choice3");

                    // act
                    const actual = bot.getBetChoice({});

                    // assert
                    expect(helpers.arrayHelper.shuffle).toHaveBeenCalledWith([]);
                    expect(bot.chance.pickone).toHaveBeenCalledWith(bot.betOptions);
                    expect(actual).toBe("choice3");
                });
            });
        });

        describe("when hedgeBetGroup include choice", () => {
            it("should return opposite choice if bot has bet opposite choice", () => {
                // arrange
                bot.getBetChoicesRatios = jest.fn().mockReturnValue([]);
                bot.betOptions = ["choice1", "choice2"];
                bot.hedgeBetGroups = [["choice1", "choice2"]];
                helpers.arrayHelper.shuffle.mockReturnValue([]);
                bot.chance.pickone.mockReturnValueOnce("choice1");
                const botInfo = { choices: ["choice2"] };

                // act
                const actual = bot.getBetChoice(botInfo);

                // assert
                expect(actual).toBe("choice2");
            });
        });
    });

    describe("getBetChoicesRatios", () => {
        it("should return expected bet choices ratios from bot settings", () => {
            // arrange
            bot.getAllBetAmountOnChoices = jest.fn().mockReturnValueOnce(10).mockReturnValueOnce(0).mockReturnValueOnce(10);
            
            bot.botSettings = { ratio: { mainOpts: 99, rareOpts: 1 }, mainOpts: ["choice1", "choice2"], rareOpts: ["choice3"] };
            const expected = [
                { group: ["choice1", "choice2"], underBetRatio: true },
                { group: ["choice3"], underBetRatio: false },
            ];

            // act
            const actual = bot.getBetChoicesRatios();

            // assert
            expect(actual).toEqual(expected);
        });
    });

    describe("getAllBetAmountOnChoices", () => {
        it("should return total bet amount on choices", () => {
            // arrange
            const choices = ["choice1", "choice2", "choice3"];
            bot.allBets = { choice1: 10, choice2: 5, choice3: 1 };
            const expected = 16;

            // act
            const actual = bot.getAllBetAmountOnChoices(choices);

            // assert
            expect(actual).toBe(expected);
        });
    });

    describe("getMaxBet", () => {
        const choice = "choice1";

        beforeEach(() => {
            bot.gameData.gameConfigs = { choices_maxbet: { [choice]: 1000 }, bot_maxbet: 2000 };
            bot.getMinBet = jest.fn().mockReturnValue(1);
        });
        it("should return max bet when total tickets = 0", () => {
            // arrange
            bot.totalTickets = 0;

            // act
            const actual = bot.getMaxBet({}, choice);

            // assert
            expect(actual).toBe(50);
        });

        it("should return max bet when total tickets != 0", () => {
            // arrange
            bot.totalTickets = 1;
            bot.smallTickets = 1;

            // act
            const actual = bot.getMaxBet({}, choice);

            // assert
            expect(actual).toBe(1000);
        });
    });

    describe("convertAmountToChip", () => {
        it("should return expected when amount is not less than chip list amount", () => {
            // arrange
            const amount = 400_000;

            // act
            const actual = bot.convertAmountToChip(amount);

            // assert
            expect(actual).toBe(200_000);
        });

        it("should return min bet when amount is < chip list amount", () => {
            // arrange
            const amount = 0.5;
            bot.getMinBet = jest.fn().mockReturnValue(1);

            // act
            const actual = bot.convertAmountToChip(amount);

            // assert
            expect(actual).toBe(1);
        });
    });


    describe("updateBotInRoomData", () => {
        beforeEach(() => {
            TableGameBot.prototype.updateBotInRoomData = jest.fn();
            bot.getMinBet = jest.fn().mockReturnValue(1);
            bot.smallTickets = 0;
        });
        const choice = "choice1";
        const amount = 10;
        const balance = 200;
        it("should call super.updateBotInRoomData", () => {
            // act
            bot.updateBotInRoomData({}, choice, amount, balance);

            // assert
            expect(TableGameBot.prototype.updateBotInRoomData).toHaveBeenCalledWith({}, "choice1", 10, 200);
        });

        it("should increase all bets", () => {
            // arrange
            bot.allBets = { [choice]: 10 };

            // act
            bot.updateBotInRoomData({}, choice, amount, balance);

            // assert
            expect(bot.allBets[choice]).toEqual(20);
        });

        it("should adjust small tickets", () => {
            // arrange
            bot.smallTickets = 0;

            // act
            bot.updateBotInRoomData({}, choice, amount, balance);

            // assert
            expect(bot.smallTickets).toBe(1);
        });
    });
});
