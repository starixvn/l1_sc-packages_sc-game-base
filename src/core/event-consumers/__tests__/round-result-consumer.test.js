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

describe("generateResultAndPublishMD5", () => {
    describe("when md5sRepository null", () => {
        it("should not publish MD5", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.roundResultPublisher.publishMD5).not.toHaveBeenCalled();
        });
    });

    describe("when md5sRepository not null", () => {
        it("should publish MD5", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };
            consumer.md5sRepository = { create: jest.fn() };
            consumer.gameData = {
                settlementResultFromAdmin: {},
            };
            consumer.definition = {
                generateResult: jest.fn(),
                generateRawResultForMd5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.roundResultPublisher.publishMD5).toHaveBeenCalled();
        });
    });

    describe("when lastMD5Record exists and matches with current roundId", () => {
        it("should decrypt result from lastMD5Record", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            const lastMD5Record = {
                encryptedResult: '{"iv": "477764b581bbaa674ca639ef1b7dee96","content": "efd5bb24b2511bdbdc0715ea6"}',
                encryptedMD5: '{"iv": "477764b581bbaa674ca639ef1b7dee96yy","content": "efd5bb24b2511bdbdc0715ea6xx"}',
                roundId: 12,
            };
            consumer.gameData = { roundId: 12 };
            consumer.md5sRepository = jest.fn();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5(lastMD5Record);

            // Assert
            expect(consumer.gameData.result).toEqual({ iv: "477764b581bbaa674ca639ef1b7dee96", content: "efd5bb24b2511bdbdc0715ea6" });
        });

        it("should decrypt md5 from lastMD5Record", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            const lastMD5Record = {
                encryptedResult: '{"iv": "477764b581bbaa674ca639ef1b7dee96","content": "efd5bb24b2511bdbdc0715ea6"}',
                encryptedMD5: '{"iv": "477764b581bbaa674ca639ef1b7dee96yy","content": "efd5bb24b2511bdbdc0715ea6xx"}',
                roundId: 12,
            };
            consumer.gameData = { roundId: 12 };
            consumer.md5sRepository = jest.fn();
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5(lastMD5Record);

            // Assert
            expect(consumer.gameData.md5).toEqual({ iv: "477764b581bbaa674ca639ef1b7dee96yy", content: "efd5bb24b2511bdbdc0715ea6xx" });
        });
    });

    describe("when lastMD5Record does not exist and settlementResultFromAdmin exist", () => {
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
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.md5sRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.gameData.result).toEqual({ red1: true, red2: false, red3: true, red4: false });
        });

        it("should build md5 from admin result", async () => {
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
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.md5sRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.gameData.md5.roundId).toBe(11);
            expect(consumer.gameData.md5.rawValue).toContain("1010_#11");
        });

        it("should create md5 record from admin result", async () => {
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
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
            };
            consumer.md5sRepository = {
                create: jest.fn(),
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };
            consumer.getNewDate = () => 123;

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.md5sRepository.create).toHaveBeenCalledWith({
                roundId: consumer.gameData.roundId,
                encryptedMD5: JSON.stringify(consumer.gameData.md5),
                encryptedResult: '{"red1":true,"red2":false,"red3":true,"red4":false}',
                time: 123,
            });
        });
    });

    describe("when lastMD5Record does not exist and settlementResultFromAdmin does not exist", () => {
        it("should generate result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {},
                roundId: 11,
            };
            consumer.definition = {
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
                generateResult: () => {
                    return { red1: true, red2: true, red3: true, red4: false };
                },
            };
            consumer.md5sRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.gameData.result).toEqual({ red1: true, red2: true, red3: true, red4: false });
        });

        it("should build md5 from generated result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {},
                roundId: 12,
            };
            consumer.definition = {
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
                generateResult: () => {
                    return { red1: true, red2: true, red3: true, red4: false };
                },
            };
            consumer.md5sRepository = {
                create: jest.fn,
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.gameData.md5.roundId).toBe(12);
            expect(consumer.gameData.md5.rawValue).toContain("1110_#12");
        });

        it("should create md5 record from generated result", async () => {
            // Arrange
            const consumer = new RoundResultConsumer();
            consumer.gameData = {
                settlementResultFromAdmin: {},
                roundId: 12,
            };
            consumer.definition = {
                generateRawResultForMd5: (result) => {
                    return `${+result.red1}${+result.red2}${+result.red3}${+result.red4}`;
                },
                generateResult: () => {
                    return { red1: true, red2: true, red3: true, red4: false };
                },
            };
            consumer.md5sRepository = {
                create: jest.fn(),
            };
            consumer.roundResultPublisher = {
                publishMD5: jest.fn(),
            };
            consumer.getNewDate = () => 123;

            // Act
            await consumer.generateResultAndPublishMD5();

            // Assert
            expect(consumer.md5sRepository.create).toHaveBeenCalledWith({
                roundId: consumer.gameData.roundId,
                encryptedMD5: JSON.stringify(consumer.gameData.md5),
                encryptedResult: '{"red1":true,"red2":true,"red3":true,"red4":false}',
                time: 123,
            });
        });
    });
});
