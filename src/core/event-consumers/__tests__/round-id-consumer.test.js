import RoundIdConsumer from "../round-id-consumer";
import GameManagementApiClientFactory from "../../game-management-api";
import GameData from "../../game-data";
import GameDefinition from "../../game-definition";

import { when } from "jest-when";

describe("RoundIdConsumer", () => {
    const gameData = new GameData(3);
    const definition = new GameDefinition({ id: 1, name: "game name" }, null, null, null);
    const mockRoundsRepository = { findOne: jest.fn() };
    const gameManagementApiClientFactory = new GameManagementApiClientFactory({});

    let roundIdConsumer;

    beforeEach(() => {
        jest.clearAllMocks();
        roundIdConsumer = new RoundIdConsumer(gameData, definition, mockRoundsRepository, gameManagementApiClientFactory);
    });

    describe("initRoundId", () => {
        describe("when last round exists", () => {
            it("should update roundid = last round id + 1", async () => {
                // Arrange
                const lastRound = { id: 123 };
                const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(lastRound) }) };
                when(roundIdConsumer.roundsRepository.findOne)
                    .calledWith({}, "id", { sort: { id: -1 } })
                    .mockReturnValue(findOneResult);

                // Act
                await roundIdConsumer.initRoundId();

                // Assert
                expect(roundIdConsumer.gameData.roundId).toBe(124);
            });
        });

        describe("when last round does not exist", () => {
            it("should get round id from archiveRound", async () => {
                // Arrange
                const lastRoundId = 125;

                const findOneResult = { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockReturnValue(undefined) }) };
                when(roundIdConsumer.roundsRepository.findOne)
                    .calledWith({}, "id", { sort: { id: -1 } })
                    .mockReturnValue(findOneResult);

                roundIdConsumer.getLastArchiveRound = jest.fn().mockReturnValue(lastRoundId);

                // Act
                await roundIdConsumer.initRoundId();

                // Assert
                expect(roundIdConsumer.gameData.roundId).toBe(125);
            });
        });
    });

    describe("getLastArchiveRound", () => {
        describe("when archive exists", () => {
            const testCases = [{ _phiens: 123 }, { _rounds: 123 }];

            it.each(testCases)("should return last round + 1", async (data) => {
                // Arrange
                const archiveStatus = { data: { lastArcId: data }, isSuccessful: true };
                roundIdConsumer.gameManagementApiClient.archiveStatus.getArchiveStatus.mockReturnValueOnce(archiveStatus);

                // Act
                const result = await roundIdConsumer.getLastArchiveRound();

                // Assert
                expect(result).toBe(124);
            });
        });

        describe("when archive does not exist", () => {
            it("should return 1", async () => {
                // Arrange

                // Act
                const result = await roundIdConsumer.getLastArchiveRound();

                // Assert
                expect(result).toBe(1);
            });
        });
    });
});
