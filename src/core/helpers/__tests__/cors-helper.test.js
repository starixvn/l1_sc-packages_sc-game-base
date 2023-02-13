import { isAllowAccess, getMainDomain, updateConfiguredDomains } from "../cors-helper";

describe("isAllowAccess", () => {
    it("should allow access if origin is falsy", async () => {
        const result = isAllowAccess();
        expect(result).toBe(true);
    });

    it("should allow access if configuredDomains is falsy", async () => {
        const result = isAllowAccess("origin");
        expect(result).toBe(true);
    });

    describe("when mainDomain does not has subdomain", () => {
        it("should allow access if configuredDomains includes mainDomain", async () => {
            // Arrange
            updateConfiguredDomains("xyz.com;abcd.com;abd.com");

            // Act
            //await queryDomains();
            const result = isAllowAccess("abd.com");

            // Assert
            expect(result).toBe(true);
        });

        it("should not allow access if configuredDomains does not include mainDomain", async () => {
            // Arrange
            updateConfiguredDomains("xyz.com;abcd.com;abd.com");

            // Act
            //await queryDomains();
            const result = isAllowAccess("abdx.com");

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("when mainDomain has subdomain", () => {
        it("should allow access if configuredDomains includes mainDomain", async () => {
            // Arrange
            updateConfiguredDomains("xyz.com;abcd.com;abd.com");

            // Act
            //await queryDomains();
            const result = isAllowAccess("xxx.abd.com");

            // Assert
            expect(result).toBe(true);
        });

        it("should not allow access if configuredDomains does not include mainDomain", async () => {
            // Arrange
            updateConfiguredDomains("xyz.com;abcd.com;abd.com");

            // Act
            //await queryDomains();
            const result = isAllowAccess("ab.abdx.com");

            // Assert
            expect(result).toBe(false);
        });
    });
});

describe("getMainDomain", () => {
    describe("when having subdomain", () => {
        test("returns the main domain for a valid domain string", () => {
            const domain = "subdomain.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with wwww", () => {
            const domain = "www.subdomain.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with http", () => {
            const domain = "http://subdomain.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with https", () => {
            const domain = "https://subdomain.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with http://www.", () => {
            const domain = "http://www.subdomain.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with https://www.", () => {
            const domain = "https://www.subdomain.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });
    });

    describe("when not having subdomain", () => {
        test("returns the main domain for a valid domain string", () => {
            const domain = "maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with wwww", () => {
            const domain = "www.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with https", () => {
            const domain = "https://maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with http", () => {
            const domain = "http://maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with http://www.", () => {
            const domain = "http://www.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });

        test("return the main domain for a valid domain string with https://www.", () => {
            const domain = "https://www.maindomain.com";
            const expectedResult = "maindomain.com";
            const mainDomain = getMainDomain(domain);
            expect(mainDomain).toBe(expectedResult);
        });
    });

    test("returns an empty string for an empty domain string", () => {
        const domain = "";
        const expectedResult = "";
        const mainDomain = getMainDomain(domain);
        expect(mainDomain).toBe(expectedResult);
    });

    test("returns an empty string for a domain string that has only one component", () => {
        const domain = "example";
        const expectedResult = "";
        const mainDomain = getMainDomain(domain);
        expect(mainDomain).toBe(expectedResult);
    });

    test("returns an empty string for a null domain string", () => {
        const domain = null;
        const expectedResult = "";
        const mainDomain = getMainDomain(domain);
        expect(mainDomain).toBe(expectedResult);
    });
});
