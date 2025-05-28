import GamePromotionApiClientFactory from "../game-promotion-api-client-factory";
import { GamePromotionApiClient } from "@sc/game-promotion-api-client";

// Mock the logger
jest.mock("sc-common", () => ({
    logger: {
        log: jest.fn(),
        logError: jest.fn(),
    },
}));

// Mock the official GamePromotionApiClient
jest.mock("@sc/game-promotion-api-client", () => ({
    GamePromotionApiClient: jest.fn().mockImplementation(() => ({
        claimPromotion: jest.fn(),
        deductBonusItem: jest.fn(),
        createPromotionTicket: jest.fn(),
    })),
}));

describe("GamePromotionApiClientFactory", () => {
    let factory;
    let mockAppConfigs;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("when promotion settings are configured", () => {
        beforeEach(() => {
            mockAppConfigs = {
                promotionApiSettings: {
                    baseUrl: "https://promotion-api.lumigame.com",
                    timeout: 5000,
                    useAuthentication: true,
                },
            };
            factory = new GamePromotionApiClientFactory(mockAppConfigs);
        });

        it("should create GamePromotionApiClient with correct configuration", () => {
            expect(GamePromotionApiClient).toHaveBeenCalledWith({
                baseURL: "https://promotion-api.lumigame.com",
                timeout: 5000,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        });

        it("should return the client instance", () => {
            const instance = factory.instance();
            expect(instance).toBeDefined();
            expect(instance.claimPromotion).toBeDefined();
            expect(instance.deductBonusItem).toBeDefined();
            expect(instance.createPromotionTicket).toBeDefined();
        });

        it("should return true for isAvailable()", () => {
            expect(factory.isAvailable()).toBe(true);
        });
    });

    describe("when promotion settings are not configured", () => {
        beforeEach(() => {
            mockAppConfigs = {};
            factory = new GamePromotionApiClientFactory(mockAppConfigs);
        });

        it("should not create GamePromotionApiClient", () => {
            expect(GamePromotionApiClient).not.toHaveBeenCalled();
        });

        it("should return null for instance()", () => {
            const instance = factory.instance();
            expect(instance).toBeNull();
        });

        it("should return false for isAvailable()", () => {
            expect(factory.isAvailable()).toBe(false);
        });
    });

    describe("when baseUrl is missing", () => {
        beforeEach(() => {
            mockAppConfigs = {
                promotionApiSettings: {
                    timeout: 5000,
                    useAuthentication: true,
                },
            };
        });

        it("should throw an error", () => {
            expect(() => {
                new GamePromotionApiClientFactory(mockAppConfigs);
            }).toThrow("baseUrl is required in promotionApiSettings");
        });
    });

    describe("when using default timeout", () => {
        beforeEach(() => {
            mockAppConfigs = {
                promotionApiSettings: {
                    baseUrl: "https://promotion-api.lumigame.com",
                    useAuthentication: false,
                },
            };
            factory = new GamePromotionApiClientFactory(mockAppConfigs);
        });

        it("should use default timeout of 5000ms", () => {
            expect(GamePromotionApiClient).toHaveBeenCalledWith({
                baseURL: "https://promotion-api.lumigame.com",
                timeout: 5000,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        });
    });

    describe("when authentication is disabled", () => {
        beforeEach(() => {
            mockAppConfigs = {
                promotionApiSettings: {
                    baseUrl: "https://promotion-api.lumigame.com",
                    timeout: 3000,
                    useAuthentication: false,
                },
            };
            factory = new GamePromotionApiClientFactory(mockAppConfigs);
        });

        it("should create client with basic headers only", () => {
            expect(GamePromotionApiClient).toHaveBeenCalledWith({
                baseURL: "https://promotion-api.lumigame.com",
                timeout: 3000,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        });
    });

    describe("when custom timeout is provided", () => {
        beforeEach(() => {
            mockAppConfigs = {
                promotionApiSettings: {
                    baseUrl: "https://promotion-api.lumigame.com",
                    timeout: 10000,
                    useAuthentication: true,
                },
            };
            factory = new GamePromotionApiClientFactory(mockAppConfigs);
        });

        it("should use the custom timeout", () => {
            expect(GamePromotionApiClient).toHaveBeenCalledWith({
                baseURL: "https://promotion-api.lumigame.com",
                timeout: 10000,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        });
    });
});
