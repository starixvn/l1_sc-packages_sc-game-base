import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";

import BaseBot from "../base-bot";

const gameData = new GameData(3);
const definition = new GameDefinition({ id: 1, name: "game name", durations: { lockingBet: 2 } });
/** @type {mongoose.Model}*/
const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);
userInfosRepository.countDocuments.mockReturnValue({ exec: jest.fn() });

const initBot = function () {
    return new BaseBot(definition, gameData, userInfosRepository);
}

describe("reset tests", () => {
    it("should call removeAllBots when botenabled is false", async () => {
        gameData.gameConfigs = { botenabled: false };

        const baseBot = initBot();
        jest.spyOn(baseBot, "removeAllBots");

        await baseBot.reset();

        expect(baseBot.removeAllBots).toHaveBeenCalled();
    });

    it("should call processDisabledBots when botenabled is true and calculate maxNumberOfBots", async () => {
        gameData.gameConfigs = { botenabled: true, maxbot: 0.5 };
        userInfosRepository.countDocuments().exec.mockReturnValueOnce(100);

        const baseBot = initBot();
        jest.spyOn(baseBot, "processDisabledBots");

        await baseBot.reset();

        expect(baseBot.processDisabledBots).toHaveBeenCalled();
        expect(baseBot.maxNumberOfBots).toEqual(100 * 0.5);
    });
});

describe("run tests", () => {
    it("should add bot to indicesOfBotsToBeRemoved after placing bet", async () => {
        gameData.gameConfigs = { botenabled: true };
        const bots = [
            { id: 1, name: "bot1", type: true, red: 2000 },
            { id: 2, name: "bot2", type: true, red: 2000 },
            { id: 3, name: "bot3", type: true, red: 2000 },
            { id: 4, name: "bot4", type: true, red: 2000 },
            { id: 5, name: "bot5", type: true, red: 2000 },
            { id: 6, name: "bot6", type: true, red: 2000 },
        ];

        const baseBot = initBot();
        baseBot.bots = bots;
        jest.spyOn(baseBot, "placeBet");

        await baseBot.run();

        expect(baseBot.placeBet).toHaveBeenCalled();
    });
});
