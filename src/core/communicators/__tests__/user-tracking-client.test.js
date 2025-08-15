import { TrackingClient } from "@sc/user-tracking-client";

import UserTrackingClient from "../user-tracking-client";

jest.mock("@sc/user-tracking-client");

describe("user tracking client test", () => {
    let userTrackingClient;
    let mockTrackingClient;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Mock console methods
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});

        // Create mock TrackingClient instance
        mockTrackingClient = {
            signIn: jest.fn(),
            signOut: jest.fn(),
        };

        // Mock the TrackingClient constructor
        TrackingClient.mockImplementation(() => mockTrackingClient);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("constructor", () => {
        describe("when appConfigs has trackingApiSettings", () => {
            it("should create TrackingClient with baseUrl and headers", () => {
                // arrange
                const appConfigs = {
                    trackingApiSettings: {
                        baseUrl: "http://localhost:3000",
                        headers: { Authorization: "Bearer token" },
                    },
                };

                // act
                userTrackingClient = new UserTrackingClient(appConfigs);

                // assert
                expect(TrackingClient).toHaveBeenCalledWith("http://localhost:3000", { headers: { Authorization: "Bearer token" } });
                expect(userTrackingClient.client).toBe(mockTrackingClient);
            });
        });

        describe("when appConfigs has trackingApiSettings without headers", () => {
            it("should create TrackingClient with baseUrl and empty headers", () => {
                // arrange
                const appConfigs = {
                    trackingApiSettings: {
                        baseUrl: "http://localhost:3000",
                    },
                };

                // act
                userTrackingClient = new UserTrackingClient(appConfigs);

                // assert
                expect(TrackingClient).toHaveBeenCalledWith("http://localhost:3000", { headers: {} });
                expect(userTrackingClient.client).toBe(mockTrackingClient);
            });
        });
    });

    describe("signIn", () => {
        beforeEach(() => {
            const appConfigs = {
                trackingApiSettings: {
                    baseUrl: "http://localhost:3000",
                    headers: {},
                },
            };
            userTrackingClient = new UserTrackingClient(appConfigs);
        });

        describe("when signIn succeeds", () => {
            it("should call client.signIn with sessionData and log response", async () => {
                // arrange
                const sessionData = { userId: "123", gameId: "game1" };
                const mockResponse = { success: true, sessionId: "session123" };
                mockTrackingClient.signIn.mockResolvedValue(mockResponse);

                // act
                await userTrackingClient.signIn(sessionData);

                // assert
                expect(mockTrackingClient.signIn).toHaveBeenCalledWith({ ...sessionData });
                expect(console.log).toHaveBeenCalledWith(mockResponse);
            });
        });

        describe("when signIn fails", () => {
            it("should catch error and log error message", async () => {
                // arrange
                const sessionData = { userId: "123", gameId: "game1" };
                const mockError = new Error("Network error");
                mockTrackingClient.signIn.mockRejectedValue(mockError);

                // act
                await userTrackingClient.signIn(sessionData);

                // assert
                expect(mockTrackingClient.signIn).toHaveBeenCalledWith({ ...sessionData });
                expect(console.error).toHaveBeenCalledWith("Failed to track user game session:", mockError);
            });
        });

        describe("when signIn throws different error types", () => {
            it("should handle TypeError", async () => {
                // arrange
                const sessionData = { userId: "123" };
                const mockError = new TypeError("Invalid data");
                mockTrackingClient.signIn.mockRejectedValue(mockError);

                // act
                await userTrackingClient.signIn(sessionData);

                // assert
                expect(console.error).toHaveBeenCalledWith("Failed to track user game session:", mockError);
            });

            it("should handle string error", async () => {
                // arrange
                const sessionData = { userId: "123" };
                const mockError = "Connection failed";
                mockTrackingClient.signIn.mockRejectedValue(mockError);

                // act
                await userTrackingClient.signIn(sessionData);

                // assert
                expect(console.error).toHaveBeenCalledWith("Failed to track user game session:", mockError);
            });
        });
    });

    describe("signOut", () => {
        beforeEach(() => {
            const appConfigs = {
                trackingApiSettings: {
                    baseUrl: "http://localhost:3000",
                    headers: {},
                },
            };
            userTrackingClient = new UserTrackingClient(appConfigs);
        });

        describe("when signOut succeeds", () => {
            it("should call client.signOut with sessionId and gameId, log response, and return data", async () => {
                // arrange
                const params = { sessionId: "session123", gameId: "game1" };
                const mockResponse = {
                    success: true,
                    data: { sessionEnded: true, duration: 3600 },
                };
                mockTrackingClient.signOut.mockResolvedValue(mockResponse);

                // act
                const result = await userTrackingClient.signOut(params);

                // assert
                expect(mockTrackingClient.signOut).toHaveBeenCalledWith({
                    sessionId: "session123",
                    gameId: "game1",
                });
                expect(console.log).toHaveBeenCalledWith(mockResponse);
            });
        });

        describe("when signOut fails", () => {
            it("should catch error and log error message", async () => {
                // arrange
                const params = { sessionId: "session123", gameId: "game1" };
                const mockError = new Error("Session not found");
                mockTrackingClient.signOut.mockRejectedValue(mockError);

                // act
                const result = await userTrackingClient.signOut(params);

                // assert
                expect(mockTrackingClient.signOut).toHaveBeenCalledWith({
                    sessionId: "session123",
                    gameId: "game1",
                });
                expect(console.error).toHaveBeenCalledWith("Failed to track user game session:", mockError);
                expect(result).toBeUndefined();
            });
        });

        describe("when signOut throws different error types", () => {
            it("should handle TypeError", async () => {
                // arrange
                const params = { sessionId: "session123", gameId: "game1" };
                const mockError = new TypeError("Invalid session");
                mockTrackingClient.signOut.mockRejectedValue(mockError);

                // act
                const result = await userTrackingClient.signOut(params);

                // assert
                expect(console.error).toHaveBeenCalledWith("Failed to track user game session:", mockError);
                expect(result).toBeUndefined();
            });

            it("should handle string error", async () => {
                // arrange
                const params = { sessionId: "session123", gameId: "game1" };
                const mockError = "Session expired";
                mockTrackingClient.signOut.mockRejectedValue(mockError);

                // act
                const result = await userTrackingClient.signOut(params);

                // assert
                expect(console.error).toHaveBeenCalledWith("Failed to track user game session:", mockError);
                expect(result).toBeUndefined();
            });
        });

        describe("when response has no data property", () => {
            it("should return undefined when response.data is undefined", async () => {
                // arrange
                const params = { sessionId: "session123", gameId: "game1" };
                const mockResponse = { success: true }; // No data property
                mockTrackingClient.signOut.mockResolvedValue(mockResponse);

                // act
                const result = await userTrackingClient.signOut(params);

                // assert
                expect(console.log).toHaveBeenCalledWith(mockResponse);
                expect(result).toBeUndefined();
            });
        });
    });
});
