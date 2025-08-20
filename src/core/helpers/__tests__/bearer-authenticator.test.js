import { discovery, clientCredentialsGrant, allowInsecureRequests } from "openid-client";
import { logger } from "sc-common";

import BearerAuthenticator from "../bearer-authenticator";

jest.mock("openid-client");
jest.mock("sc-common");

describe("BearerAuthenticator", () => {
    let bearerAuthenticator;
    let authConfigs;
    let mockDiscovery;
    let mockClientCredentialsGrant;

    beforeEach(() => {
        authConfigs = {
            url: "http://localhost:8080",
            id: "test-client-id",
            secret: "test-client-secret",
        };

        mockDiscovery = jest.fn();
        mockClientCredentialsGrant = jest.fn();

        discovery.mockImplementation(mockDiscovery);
        clientCredentialsGrant.mockImplementation(mockClientCredentialsGrant);

        logger.log.mockReturnValue(undefined);
        logger.logError.mockReturnValue(undefined);
        logger.logWarning.mockReturnValue(undefined);

        bearerAuthenticator = new BearerAuthenticator(authConfigs);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
    });

    describe("constructor", () => {
        it("should initialize with auth configs", () => {
            expect(bearerAuthenticator.authConfigs).toBe(authConfigs);
        });
    });

    describe("autoUpdateToken", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should call updateToken and schedule refresh", async () => {
            const updateTokenSpy = jest.spyOn(bearerAuthenticator, "updateToken").mockResolvedValue();
            const setTimeoutSpy = jest.spyOn(global, "setTimeout");

            await bearerAuthenticator.autoUpdateToken();

            expect(updateTokenSpy).toHaveBeenCalledTimes(1);
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
        });
    });

    describe("refresh", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        describe("when token is not expired", () => {
            it("should only schedule next refresh", async () => {
                jest.spyOn(bearerAuthenticator, "isTokenExpired").mockReturnValue(false);
                const updateTokenSpy = jest.spyOn(bearerAuthenticator, "updateToken").mockResolvedValue();
                const setTimeoutSpy = jest.spyOn(global, "setTimeout");

                await bearerAuthenticator.refresh();

                expect(updateTokenSpy).not.toHaveBeenCalled();
                expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
            });
        });

        describe("when token is expired", () => {
            it("should update token and schedule next refresh", async () => {
                jest.spyOn(bearerAuthenticator, "isTokenExpired").mockReturnValue(true);
                const updateTokenSpy = jest.spyOn(bearerAuthenticator, "updateToken").mockResolvedValue();
                const setTimeoutSpy = jest.spyOn(global, "setTimeout");

                await bearerAuthenticator.refresh();

                expect(updateTokenSpy).toHaveBeenCalledTimes(1);
                expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
            });
        });
    });

    describe("isTokenExpired", () => {
        describe("when expired is null", () => {
            it("should return true", () => {
                bearerAuthenticator.expired = null;
                expect(bearerAuthenticator.isTokenExpired()).toBe(true);
            });
        });

        describe("when expired is undefined", () => {
            it("should return true", () => {
                bearerAuthenticator.expired = undefined;
                expect(bearerAuthenticator.isTokenExpired()).toBe(true);
            });
        });

        describe("when token is expired", () => {
            it("should return true", () => {
                const currentTime = Math.floor(Date.now() / 1000);
                bearerAuthenticator.expired = currentTime - 10;
                expect(bearerAuthenticator.isTokenExpired()).toBe(true);
            });
        });

        describe("when token is about to expire", () => {
            it("should return true when within 5 minutes of expiry", () => {
                const currentTime = Math.floor(Date.now() / 1000);
                bearerAuthenticator.expired = currentTime + 240;
                expect(bearerAuthenticator.isTokenExpired()).toBe(true);
            });
        });

        describe("when token is valid", () => {
            it("should return false when token has more than 5 minutes left", () => {
                const currentTime = Math.floor(Date.now() / 1000);
                bearerAuthenticator.expired = currentTime + 400;
                expect(bearerAuthenticator.isTokenExpired()).toBe(false);
            });
        });
    });

    describe("updateToken", () => {
        describe("when getBearerToken succeeds", () => {
            it("should update token and expired time", async () => {
                const mockToken = {
                    access_token: "test-access-token",
                    token_type: "Bearer",
                    expiresIn: () => 3600,
                };
                const mockResult = {
                    token: mockToken,
                    expired: Math.floor(Date.now() / 1000) + 3600,
                };
                jest.spyOn(bearerAuthenticator, "getBearerToken").mockResolvedValue(mockResult);

                await bearerAuthenticator.updateToken();

                expect(bearerAuthenticator.token).toBe(mockToken);
                expect(bearerAuthenticator.expired).toBe(mockResult.expired);
                expect(logger.log).toHaveBeenCalledWith("Get bearer token successfully.");
            });

            it("should handle token without expiresIn", async () => {
                const mockToken = {
                    access_token: "test-access-token",
                    token_type: "Bearer",
                };
                const mockResult = {
                    token: mockToken,
                    expired: null,
                };
                jest.spyOn(bearerAuthenticator, "getBearerToken").mockResolvedValue(mockResult);

                await bearerAuthenticator.updateToken();

                expect(bearerAuthenticator.token).toBe(mockToken);
                expect(bearerAuthenticator.expired).toBe(null);
                expect(logger.log).toHaveBeenCalledWith("Get bearer token successfully.");
            });
        });

        describe("when getBearerToken returns null", () => {
            it("should log error and not update token", async () => {
                jest.spyOn(bearerAuthenticator, "getBearerToken").mockResolvedValue(null);

                await bearerAuthenticator.updateToken();

                expect(bearerAuthenticator.token).toBeUndefined();
                expect(bearerAuthenticator.expired).toBeUndefined();
                expect(logger.logError).toHaveBeenCalledWith("No access token received");
            });
        });

        describe("when getBearerToken throws error", () => {
            it("should log error and not update token", async () => {
                const error = new Error("Token request failed");
                jest.spyOn(bearerAuthenticator, "getBearerToken").mockRejectedValue(error);

                await bearerAuthenticator.updateToken();

                expect(bearerAuthenticator.token).toBeUndefined();
                expect(bearerAuthenticator.expired).toBeUndefined();
                expect(logger.logError).toHaveBeenCalledWith("Get bearer token failed: Token request failed");
            });
        });
    });

    describe("getBearerToken", () => {
        describe("when discovery and token grant succeed", () => {
            it("should return token with expiration", async () => {
                const mockConfig = { issuer: "test-issuer" };
                const mockToken = {
                    access_token: "test-access-token",
                    token_type: "Bearer",
                    expiresIn: () => 3600,
                };

                mockDiscovery.mockResolvedValue(mockConfig);
                mockClientCredentialsGrant.mockResolvedValue(mockToken);

                const result = await bearerAuthenticator.getBearerToken();

                expect(mockDiscovery).toHaveBeenCalledWith(new URL(authConfigs.url), authConfigs.id, authConfigs.secret, {
                    execute: [allowInsecureRequests],
                    timeout: 60,
                });
                expect(mockClientCredentialsGrant).toHaveBeenCalledWith(mockConfig);
                expect(result).toEqual({
                    token: mockToken,
                    expired: expect.any(Number),
                });
            });

            it("should return token without expiration when expiresIn is not available", async () => {
                const mockConfig = { issuer: "test-issuer" };
                const mockToken = {
                    access_token: "test-access-token",
                    token_type: "Bearer",
                };

                mockDiscovery.mockResolvedValue(mockConfig);
                mockClientCredentialsGrant.mockResolvedValue(mockToken);

                const result = await bearerAuthenticator.getBearerToken();

                expect(result).toEqual({
                    token: mockToken,
                    expired: null,
                });
            });
        });

        describe("when token has no access_token", () => {
            it("should return null", async () => {
                const mockConfig = { issuer: "test-issuer" };
                const mockToken = {
                    token_type: "Bearer",
                };

                mockDiscovery.mockResolvedValue(mockConfig);
                mockClientCredentialsGrant.mockResolvedValue(mockToken);

                const result = await bearerAuthenticator.getBearerToken();

                expect(result).toBeNull();
            });
        });

        describe("when discovery throws error", () => {
            it("should throw the error", async () => {
                const error = new Error("Discovery failed");
                mockDiscovery.mockRejectedValue(error);

                await expect(bearerAuthenticator.getBearerToken()).rejects.toThrow("Discovery failed");
                expect(logger.logError).toHaveBeenCalledWith("Bearer token request failed: Discovery failed");
            });
        });

        describe("when token grant throws error", () => {
            it("should throw the error", async () => {
                const mockConfig = { issuer: "test-issuer" };
                const error = new Error("Token grant failed");
                mockDiscovery.mockResolvedValue(mockConfig);
                mockClientCredentialsGrant.mockRejectedValue(error);

                await expect(bearerAuthenticator.getBearerToken()).rejects.toThrow("Token grant failed");
                expect(logger.logError).toHaveBeenCalledWith("Bearer token request failed: Token grant failed");
            });
        });
    });

    describe("hasValidToken", () => {
        describe("when token exists and is not expired", () => {
            it("should return true", () => {
                bearerAuthenticator.token = { access_token: "test" };
                jest.spyOn(bearerAuthenticator, "isTokenExpired").mockReturnValue(false);

                const result = bearerAuthenticator.hasValidToken();

                expect(result).toBe(true);
            });
        });

        describe("when token does not exist", () => {
            it("should return false", () => {
                bearerAuthenticator.token = null;

                const result = bearerAuthenticator.hasValidToken();

                expect(result).toBeFalsy();
            });
        });

        describe("when token is expired", () => {
            it("should return false", () => {
                bearerAuthenticator.token = { access_token: "test" };
                jest.spyOn(bearerAuthenticator, "isTokenExpired").mockReturnValue(true);

                const result = bearerAuthenticator.hasValidToken();

                expect(result).toBe(false);
            });
        });
    });

    describe("formatToken", () => {
        describe("when token is valid", () => {
            it("should return formatted token string with capitalized Bearer", () => {
                bearerAuthenticator.token = {
                    token_type: "Bearer",
                    access_token: "test-access-token",
                };
                jest.spyOn(bearerAuthenticator, "hasValidToken").mockReturnValue(true);

                const result = bearerAuthenticator.formatToken();

                expect(result).toBe("Bearer test-access-token");
            });

            it("should capitalize lowercase token_type from OAuth server", () => {
                bearerAuthenticator.token = {
                    token_type: "bearer",
                    access_token: "test-access-token",
                };
                jest.spyOn(bearerAuthenticator, "hasValidToken").mockReturnValue(true);

                const result = bearerAuthenticator.formatToken();

                expect(result).toBe("Bearer test-access-token");
            });
        });

        describe("when token is not valid", () => {
            it("should log warning and return empty string", () => {
                jest.spyOn(bearerAuthenticator, "hasValidToken").mockReturnValue(false);

                const result = bearerAuthenticator.formatToken();

                expect(result).toBe("");
                expect(logger.logWarning).toHaveBeenCalledWith("No valid bearer token available");
            });
        });
    });
});
