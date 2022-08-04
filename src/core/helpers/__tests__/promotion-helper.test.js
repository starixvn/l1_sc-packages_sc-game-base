jest.mock("../time-helper.js", () => {
    return {
        getCurrentTime: jest.fn(() => new Date(2022, 8, 4, 11, 21)),
    };
});
import { getEffectivePromotion } from "../promotion-helper";

describe("getEffectivePromotion", () => {
    describe("when daily promotion", () => {
        describe("when start Time < end Time", () => {
            it("should return right promotion", () => {
                // Arrange
                const promotions = [
                    { startDateTime: new Date(2022, 8, 1, 10, 10), endDateTime: new Date(2022, 8, 2, 12, 10), isDaily: true },
                    {
                        startDateTime: new Date(2022, 8, 1, 10, 10),
                        endDateTime: new Date(2022, 8, 5, 12, 10),
                        isDaily: true,
                        odds: { big: 10, small: 11 },
                    },
                ];

                // Act
                const result = getEffectivePromotion(promotions);

                // Assert
                expect(result).toEqual(promotions[1]);
            });
        });

        describe("when start Time > end Time", () => {
            it("should return right promotion", () => {
                // Arrange
                const promotions = [
                    { startDateTime: new Date(2022, 8, 1, 10, 10), endDateTime: new Date(2022, 8, 2, 12, 10), isDaily: true },
                    {
                        startDateTime: new Date(2022, 8, 1, 6, 10),
                        endDateTime: new Date(2022, 8, 5, 12, 10),
                        isDaily: true,
                        odds: { big: 10, small: 11 },
                    },
                ];

                // Act
                const result = getEffectivePromotion(promotions);

                // Assert
                expect(result).toEqual(promotions[1]);
            });
        });
    });

    describe("when consecutive promotion", () => {
        it("should return right promotion", () => {
            // Arrange
            const promotions = [
                { startDateTime: new Date(2022, 8, 1, 10, 10), endDateTime: new Date(2022, 8, 2, 12, 10), isDaily: true },
                {
                    startDateTime: new Date(2022, 8, 1, 13, 10),
                    endDateTime: new Date(2022, 8, 5, 15, 10),
                    isDaily: false,
                    odds: { big: 10, small: 11 },
                },
            ];

            // Act
            const result = getEffectivePromotion(promotions);

            // Assert
            expect(result).toEqual(promotions[1]);
        });
    });

    describe("when no effective promotion", () => {
        it("should return undefined", () => {
            // Arrange
            const promotions = [
                {
                    startDateTime: new Date(2022, 8, 1, 13, 10),
                    endDateTime: new Date(2022, 8, 3, 15, 10),
                    isDaily: false,
                    odds: { big: 10, small: 11 },
                },
            ];

            // Act
            const result = getEffectivePromotion(promotions);

            // Assert
            expect(result).toEqual(undefined);
        });
    });
});
