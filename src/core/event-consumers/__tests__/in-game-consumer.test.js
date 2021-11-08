import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import BaseEventPublisher from "../../event-publishers/base-event-publisher";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";
import RoundQuery from "../../query-apis/round-query";
import InGameConsumer from "../in-game-consumer";

jest.mock("../../query-apis/round-query");
jest.mock("../../event-publishers/base-event-publisher");

const definition = new GameDefinition({ id: 1, name: "game name" });
const gameData = new GameData(30);
gameData.gameConfigs = {
    enabled: true,
    minbet: 1,
    maxbet: 1000,
    choices_maxbet: {
        choice01: 200,
    },
    odds: {
        choice01: 2,
    },
    enableFreeBet: false,
};
gameData.exchangeRates = {
    exId: 1,
    code: {
        USD: 1,
        VND: 0.00004405,
        IDR: 0.07099,
    },
};

/** @type {mongoose.Model}*/
const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);

const roundQuery = new RoundQuery();
const publisher = new BaseEventPublisher();
const getBalance = jest.fn();
const realPlayer = {
    socketClient: {
        emit: jest.fn(),
    },
    profile: {
        name: "player01",
    },
    session: {
        currencyGroupId: 1,
        currencyCode: "USD",
        multiplier: 1000,
    },
};
describe("consume test", () => {
    it("should publish to user game configs", async () => {
        const consumer = new InGameConsumer(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);
        consumer.buildPayload = jest.fn(() => ({}));
        await consumer.consume(realPlayer);

        expect(publisher.publishToUser).toHaveBeenCalled();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

describe("build payload test", () => {
    it("should call getBlance then return user info", async () => {
        const consumer = new InGameConsumer(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);
        userInfosRepository.findOne().lean().exec.mockReturnValueOnce({ id: 1, name: "player01" });
        roundQuery.getList.mockReturnValueOnce([]);
        const actualResult = await consumer.buildPayload(realPlayer);

        expect(roundQuery.getList).toHaveBeenCalledWith(definition.numberOfRoundHistory);
        expect(getBalance).toHaveBeenCalledWith(realPlayer, true);
        expect(actualResult).not.toBeEmpty();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});
