import mongoose from "mongoose";
import { stubMongoose } from "jest-micro-auto-stub";

import AdminMonitorConsumer from "../admin-monitor-consumer";
import AdminPublisher from "../../event-publishers/admin-publisher";
import GameData from "../../game-data";

jest.mock("../../event-publishers/admin-publisher");

describe("consume test", () => {
    const gameData = new GameData();
    gameData.remainingTime = 20;

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);

    it("last round is found, publisher should call publishToAdmin", async () => {
        const adminPublisher = new AdminPublisher("", gameData);
        roundsRepository.findOne().lean().exec.mockReturnValueOnce({ id: 1, result: {}, settlementResult: {} });
        const consumer = new AdminMonitorConsumer({}, gameData, adminPublisher, roundsRepository);
        await consumer.consume({});

        expect(adminPublisher.publishToAdmin).toHaveBeenCalled();
    });

    it("last round is null, do nothing", async () => {
        const adminPublisher = new AdminPublisher("", gameData);
        roundsRepository.findOne().lean().exec.mockReturnValueOnce(null);
        const consumer = new AdminMonitorConsumer({}, gameData, adminPublisher, roundsRepository);
        await consumer.consume({});

        expect(adminPublisher.publishToAdmin).not.toHaveBeenCalled();
    });
});
