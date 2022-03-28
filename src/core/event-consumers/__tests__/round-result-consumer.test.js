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
    describe("when resultRepository null", () => {
        it("should not publish result hash", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.roundResultPublisher.publishResultHash).not.toHaveBeenCalled();
        });
    });

    describe("when resultRepository not null", () => {
        it("should publish result hash", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };
            consumer.resultRepository = { create: jest.fn() };
            consumer.gameData = {
                settlementResultFromAdmin: {},
            };
            consumer.definition = {
                generateResult: jest.fn(),
                generateRawResultForHash: jest.fn(),
            };

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
            consumer.resultRepository = jest.fn();
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
            consumer.resultRepository = jest.fn();
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

    describe("when lastResultRecord does not exist and settlementResultFromAdmin exist", () => {
        it("should get result from admin result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {
                    roundId: 11,
                    result: { red1: true, red2: false, red3: true, red4: false },
                },
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForHash: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.resultRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.gameData.result).toEqual({ red1: true, red2: false, red3: true, red4: false });
        });

        it("should build result hash from admin result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {
                    roundId: 11,
                    result: { red1: true, red2: false, red3: true, red4: false },
                },
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForHash: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.resultRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.gameData.resultHash.roundId).toBe(11);
            expect(consumer.gameData.resultHash.rawValue).toContain("1010_{#11");
        });

        it("should create result hash record from admin result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {
                    roundId: 11,
                    result: { red1: true, red2: false, red3: true, red4: false },
                },
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForHash: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.resultRepository = {
                create: jest.fn(),
            };
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };
            consumer.getNewDate = () => 123;

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.resultRepository.create).toHaveBeenCalledWith({
                roundId: consumer.gameData.roundId,
                encryptedResultHash: JSON.stringify(consumer.gameData.resultHash),
                encryptedResult: '{"red1":true,"red2":false,"red3":true,"red4":false}',
                time: 123,
            });
        });
    });

    describe("when lastResultRecord does not exist and settlementResultFromAdmin does not exist", () => {
        it("should generate result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {},
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForHash: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
                generateResult: () => {
                    return { red1: true, red2: true, red3: true, red4: false };
                },
            };
            consumer.resultRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.gameData.result).toEqual({ red1: true, red2: true, red3: true, red4: false });
        });

        it("should build result hash from generated result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {},
                roundId: 12,
            };
            consumer.definition = {
                generateRawResultForHash: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
                generateResult: () => {
                    return { red1: true, red2: true, red3: true, red4: false };
                },
            };
            consumer.resultRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.gameData.resultHash.roundId).toBe(12);
            expect(consumer.gameData.resultHash.rawValue).toContain("1110_{#12");
        });

        it("should create result hash record from generated result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {},
                roundId: 12,
            };
            consumer.definition = {
                generateRawResultForHash: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
                generateResult: () => {
                    return { red1: true, red2: true, red3: true, red4: false };
                },
            };
            consumer.resultRepository = {
                create: jest.fn(),
            };
            consumer.roundResultPublisher = {
                publishResultHash: jest.fn(),
            };
            consumer.getNewDate = () => 123;

            // Act
            await consumer.generateResultAndPublishHash();

            // Assert
            expect(consumer.resultRepository.create).toHaveBeenCalledWith({
                roundId: consumer.gameData.roundId,
                encryptedResultHash: JSON.stringify(consumer.gameData.resultHash),
                encryptedResult: '{"red1":true,"red2":true,"red3":true,"red4":false}',
                time: 123,
            });
        });
    });
});
