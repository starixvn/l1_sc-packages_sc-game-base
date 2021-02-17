import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import SettleGameRoundConsumer from "../../../core/event-consumers/settle-game-round-consumer";
import { RoundResultPublisher, UserBetResultPublisher } from "../../../core/event-publishers";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableSettleGameRoundConsumer from "../table-settle-game-round-consumer";

describe("table settle game round consumer test", () => {
    const definition = new TableGameDefinition({ id: 1, name: "game name" });
    const gameData = new TableGameData(0);
    const roundResultPublisher = stub(RoundResultPublisher);
    const userBetResultPublisher = stub(UserBetResultPublisher);
    const endGame = jest.fn();
    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongooseModelStupidly(mongoose.Model);
    /** @type {mongoose.Model}*/
    const betsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongooseModelStupidly(mongoose.Model);

    const consumer = new TableSettleGameRoundConsumer({ definition, gameData, roundResultPublisher, userBetResultPublisher, endGame, roundsRepository, betsRepository, tempBetsRepository });

    it("inherit settle game round consumer", () => {
        expect(consumer instanceof SettleGameRoundConsumer)
    })

    it("queryBets_always_return correct result", async () => {
        // arrange
        const realPlayerBets = [{ round: 1, choice: "odd", amount: 10 }];
        const botBets = [{ round: 1, choice: "even", amount: 1 }];
        betsRepository.find().lean().exec.mockReturnValue(realPlayerBets);
        tempBetsRepository.find().lean().exec.mockReturnValue(botBets);

        // act
        const actualResult = await consumer.queryBets(1);

        // assert
        expect(actualResult).toEqual(realPlayerBets.concat(botBets));
    })

    it("captureBetResult_always_calls super", () => {
        // arrange
        spyOn(SettleGameRoundConsumer.prototype, "captureBetResult");

        // act
        consumer.captureBetResult(1, {});

        // assert
        expect(SettleGameRoundConsumer.prototype.captureBetResult).toHaveBeenCalled();
    })
});
