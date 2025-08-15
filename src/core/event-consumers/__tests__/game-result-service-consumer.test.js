import axios from "axios";

import GameResultServiceConsumer from "../game-result-service-consumer";

jest.mock("axios");

describe("game result service consumer test", () => {
    let gameResultServiceConsumer;
    let definition;
    let appConfigs;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Mock axios
        axios.post = jest.fn();

        // Setup test data
        definition = {
            id: "game-type-123",
        };

        appConfigs = {
            gameResultSettings: {
                baseUrl: "https://api.example.com",
                id: "api-id-123",
                key: "api-key-456",
            },
        };

        // Create instance
        gameResultServiceConsumer = new GameResultServiceConsumer({ definition, appConfigs });
    });

    describe("constructor", () => {
        it("should initialize with definition and apiSettings", () => {
            // arrange & act
            const consumer = new GameResultServiceConsumer({ definition, appConfigs });

            // assert
            expect(consumer.definition).toBe(definition);
            expect(consumer.apiSettings).toBe(appConfigs.gameResultSettings);
        });
    });

    describe("getUrl", () => {
        const params = {
            playerId: "player-123",
            operatorId: "operator-456",
            siteId: "site-789",
            roundId: "round-abc",
            mode: "demo",
            timeZoneOffset: -300,
            language: "en",
        };

        describe("when API call succeeds", () => {
            it("should make POST request with correct data and return response data", async () => {
                // arrange
                const mockResponse = {
                    data: {
                        accessUrl: "https://example.com/access/url",
                        expiresAt: "2024-01-01T12:00:00Z",
                    },
                };
                axios.post.mockResolvedValue(mockResponse);

                // act
                const result = await gameResultServiceConsumer.getUrl(params);

                // assert
                expect(axios.post).toHaveBeenCalledWith("https://api.example.com/BetHistory/GetAccessUrl", {
                    internalAuth: {
                        id: "api-id-123",
                        key: "api-key-456",
                    },
                    auth: {
                        operatorId: "operator-456",
                    },
                    gameRoundId: "round-abc",
                    playerId: "player-123",
                    siteId: "site-789",
                    mode: "demo",
                    timeZoneOffset: -300,
                    language: "en",
                    gameTypeId: "game-type-123",
                });
                expect(result).toEqual(mockResponse.data);
            });
        });

        describe("when API call fails", () => {
            it("should throw error when axios.post rejects", async () => {
                // arrange
                const mockError = new Error("Network error");
                axios.post.mockRejectedValue(mockError);

                // act & assert
                await expect(gameResultServiceConsumer.getUrl(params)).rejects.toThrow("Network error");
            });
        });

        describe("when API returns error response", () => {
            it("should throw error when response contains error", async () => {
                // arrange
                const mockErrorResponse = {
                    response: {
                        data: { error: "Invalid parameters" },
                        status: 400,
                    },
                };
                axios.post.mockRejectedValue(mockErrorResponse);

                // act & assert
                await expect(gameResultServiceConsumer.getUrl(params)).rejects.toEqual(mockErrorResponse);
            });
        });

        describe("when different parameter combinations", () => {
            it("should handle minimal required parameters", async () => {
                // arrange
                const minimalParams = {
                    playerId: "player-123",
                    operatorId: "operator-456",
                    siteId: "site-789",
                    roundId: "round-abc",
                };
                const mockResponse = { data: { accessUrl: "https://example.com" } };
                axios.post.mockResolvedValue(mockResponse);

                // act
                const result = await gameResultServiceConsumer.getUrl(minimalParams);

                // assert
                expect(axios.post).toHaveBeenCalledWith("https://api.example.com/BetHistory/GetAccessUrl", {
                    internalAuth: {
                        id: "api-id-123",
                        key: "api-key-456",
                    },
                    auth: {
                        operatorId: "operator-456",
                    },
                    gameRoundId: "round-abc",
                    playerId: "player-123",
                    siteId: "site-789",
                    mode: undefined,
                    timeZoneOffset: undefined,
                    language: undefined,
                    gameTypeId: "game-type-123",
                });
                expect(result).toEqual(mockResponse.data);
            });

            it("should handle all parameters including optional ones", async () => {
                // arrange
                const fullParams = {
                    playerId: "player-123",
                    operatorId: "operator-456",
                    siteId: "site-789",
                    roundId: "round-abc",
                    mode: "real",
                    timeZoneOffset: 0,
                    language: "es",
                };
                const mockResponse = { data: { accessUrl: "https://example.com" } };
                axios.post.mockResolvedValue(mockResponse);

                // act
                const result = await gameResultServiceConsumer.getUrl(fullParams);

                // assert
                expect(axios.post).toHaveBeenCalledWith("https://api.example.com/BetHistory/GetAccessUrl", {
                    internalAuth: {
                        id: "api-id-123",
                        key: "api-key-456",
                    },
                    auth: {
                        operatorId: "operator-456",
                    },
                    gameRoundId: "round-abc",
                    playerId: "player-123",
                    siteId: "site-789",
                    mode: "real",
                    timeZoneOffset: 0,
                    language: "es",
                    gameTypeId: "game-type-123",
                });
                expect(result).toEqual(mockResponse.data);
            });
        });

        describe("when URL construction", () => {
            it("should construct URL correctly with baseUrl", async () => {
                // arrange
                const mockResponse = { data: { accessUrl: "https://example.com" } };
                axios.post.mockResolvedValue(mockResponse);

                // act
                await gameResultServiceConsumer.getUrl(params);

                // assert
                expect(axios.post).toHaveBeenCalledWith("https://api.example.com/BetHistory/GetAccessUrl", expect.any(Object));
            });

            it("should handle different baseUrl formats", async () => {
                // arrange
                const customAppConfigs = {
                    gameResultSettings: {
                        baseUrl: "http://localhost:8080",
                        id: "api-id-123",
                        key: "api-key-456",
                    },
                };
                const customConsumer = new GameResultServiceConsumer({ definition, appConfigs: customAppConfigs });
                const mockResponse = { data: { accessUrl: "https://example.com" } };
                axios.post.mockResolvedValue(mockResponse);

                // act
                await customConsumer.getUrl(params);

                // assert
                expect(axios.post).toHaveBeenCalledWith("http://localhost:8080/BetHistory/GetAccessUrl", expect.any(Object));
            });
        });

        describe("when response data structure", () => {
            it("should return response.data directly", async () => {
                // arrange
                const mockResponseData = {
                    accessUrl: "https://example.com/access/url",
                    expiresAt: "2024-01-01T12:00:00Z",
                    sessionId: "session-123",
                };
                const mockResponse = { data: mockResponseData };
                axios.post.mockResolvedValue(mockResponse);

                // act
                const result = await gameResultServiceConsumer.getUrl(params);

                // assert
                expect(result).toBe(mockResponseData);
                expect(result).toEqual(mockResponseData);
            });

            it("should handle empty response data", async () => {
                // arrange
                const mockResponse = { data: {} };
                axios.post.mockResolvedValue(mockResponse);

                // act
                const result = await gameResultServiceConsumer.getUrl(params);

                // assert
                expect(result).toEqual({});
            });

            it("should handle null response data", async () => {
                // arrange
                const mockResponse = { data: null };
                axios.post.mockResolvedValue(mockResponse);

                // act
                const result = await gameResultServiceConsumer.getUrl(params);

                // assert
                expect(result).toBeNull();
            });
        });
    });
});
