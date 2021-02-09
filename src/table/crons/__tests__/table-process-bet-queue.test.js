import "jest-extended";

import { stub } from "jest-micro-auto-stub";

import ProcessBetQueue from "../../../core/crons/process-bet-queue";
import PlaceBetPublisher from "../../event-publishers/table-place-bet-publisher";
import TableGameData from "../../table-game-data";
import TableGameDefinition from "../../table-game-definition";
import TableProcessBetQueue from "../table-process-bet-queue";

describe("table process bet queue test", () => {
    const definition = new TableGameDefinition({ name: "game name" });
    const gameData = new TableGameData(0);
    const placeBetPublisher = stub(PlaceBetPublisher);
    const betQueue = new TableProcessBetQueue({ definition, gameData, placeBetPublisher })

    it("inherit ProcessBetQueue", () => {
        expect(betQueue instanceof ProcessBetQueue)
    })
})