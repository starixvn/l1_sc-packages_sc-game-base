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

    /** @type {RoundResultPublisher}*/
    const roundResultPublisher = stub(RoundResultPublisher);

    /** @type {UserBetResultPublisher}*/
    const userBetResultPublisher = stub(UserBetResultPublisher);

    const endGame = jest.fn();

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongooseModelStupidly(mongoose.Model);

    const consumer = new TableSettleGameRoundConsumer({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        endGame,
        roundsRepository,
        betsRepository,
        tempBetsRepository,
    });

    it("inherit settle game round consumer", () => {
        expect(consumer instanceof SettleGameRoundConsumer);
    });

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
    });

    describe("captureBetResult_", () => {
        beforeEach(() => {
            // arrange
            spyOn(SettleGameRoundConsumer.prototype, "captureBetResult");
        });

        it("always_calls super", () => {
            // act
            consumer.captureBetResult(1, {});

            // assert
            expect(SettleGameRoundConsumer.prototype.captureBetResult).toHaveBeenCalled();
        });

        it("totalWin > 0_assign correct winningStatus", () => {
            // arrange
            const uid = 1;
            const betResult = {
                totalBetAmount: 0,
                totalWin: 1,
                netWin: 0,
                totalLost: 0,
                winningByChoices: {},
            };
            gameData.winningPlayers = {};
            const winningStatus = {
                win: true,
                bet: 1,
                winningByChoices: {},
            };
            const player = {
                id: uid,
                name: "name",
                red: 1000,
                avatarId: 1,
                type: false,
            };
            gameData.players[uid] = player;

            // act
            consumer.captureBetResult(uid, betResult);

            // assert
            expect(gameData.winningPlayers[uid]).toEqual(winningStatus);
            expect(gameData.players[uid].red).toEqual(1001);
        });
    });

    it("collectRoundResult_always_calls super", () => {
        // arrange
        const result = { red1: true, red2: false, red3: true, red4: false };
        const settlementResult = { odd: false, even: true };
        const roundId = 1;
        const roundResult = {
            result,
            settlementResult,
            roundId,
        };
        spyOn(SettleGameRoundConsumer.prototype, "collectRoundResult").and.returnValue(roundResult);

        // act
        consumer.collectRoundResult(result, settlementResult, roundId);

        // assert
        expect(SettleGameRoundConsumer.prototype.collectRoundResult).toHaveBeenCalledWith(result, settlementResult, roundId);
    });
});
