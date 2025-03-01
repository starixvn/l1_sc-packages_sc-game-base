import RoundResultConsumer from "../round-result-consumer";
jest.mock("../../helpers/crypto-helper", () => {
    return {
        encrypt: jest.fn((input) => {
            return input;
        }),
        decrypt: jest.fn((hash) => {
            return hash;
        }),
    };
});

describe("generateResultAndPublishHash", () => {
    describe("when resultsRepository not null", () => {
        it("should publish result hash", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };
            consumer.resultsRepository = { create: jest.fn() };
            consumer.definition = {
                generateResult: jest.fn(),
                generateRawResultForHash: jest.fn(),
            };
            consumer.gameData.gameConfigs = {};

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.roundResultPublisher.publishResultHash).toHaveBeenCalled();
        });
    });

    describe("when lastResultRecord exists and matches with current roundId", () => {
        it("should decrypt result from lastResultRecord", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            const lastResultRecord = {
                encryptedResult: '{"iv": "477764b581bbaa674ca639ef1b7dee96","content": "efd5bb24b2511bdbdc0715ea6"}',
                encryptedResultHash: '{"iv": "477764b581bbaa674ca639ef1b7dee96yy","content": "efd5bb24b2511bdbdc0715ea6xx"}',
                roundId: 12,
            };
            consumer.gameData = { roundId: 12 };
            consumer.resultsRepository = jest.fn();
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishHash(lastResultRecord);

            // Assert
            expect(consumer.gameData.result).toEqual({ iv: "477764b581bbaa674ca639ef1b7dee96", content: "efd5bb24b2511bdbdc0715ea6" });
        });

        it("should decrypt result hash from lastResultRecord", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            const lastResultRecord = {
                encryptedResult: '{"iv": "477764b581bbaa674ca639ef1b7dee96","content": "efd5bb24b2511bdbdc0715ea6"}',
                encryptedResultHash: '{"iv": "477764b581bbaa674ca639ef1b7dee96yy","content": "efd5bb24b2511bdbdc0715ea6xx"}',
                roundId: 12,
            };
            consumer.gameData = { roundId: 12 };
            consumer.resultsRepository = jest.fn();
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishHash(lastResultRecord);

            // Assert
            expect(consumer.gameData.resultHash).toEqual({
                iv: "477764b581bbaa674ca639ef1b7dee96yy",
                content: "efd5bb24b2511bdbdc0715ea6xx",
            });
        });
    });
});
