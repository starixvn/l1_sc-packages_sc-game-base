import { logger } from "sc-common";

import { HttpRouter } from "..";
import GameData from "../../game-data";

jest.mock("sc-common");

describe("http router test", () => {
    const appConfigs = {
        apiSettings: {
            authUrl: "http://localhost",
        },
        authenticateSettings: {
            audiences: [],
        },
    };
    const gameData = new GameData(0);
    const app = { get: jest.fn() };
    const router = new HttpRouter(appConfigs, gameData);
    logger.logError.mockReturnValue(jest.fn());

    it("init_always_calls app.get", () => {
        // act
        router.init(app);

        // assert
        expect(app.get).toHaveBeenCalled();
    });

    describe("handleOnlineUsers_", () => {
        const res = {
            send: jest.fn(),
        };

        it("normal_response online users", () => {
            // arrange
            const onlineUsers = [];
            spyOn(router, "collectOnlineUsers").and.returnValue(onlineUsers);

            // act
            router.handleOnlineUsers(res);

            // assert
            expect(res.send).toHaveBeenCalledWith(onlineUsers);
        });

        it("have exception_response error", () => {
            // arrange
            spyOn(router, "collectOnlineUsers").and.throwError("error");

            // act
            router.handleOnlineUsers(res);

            // assert
            expect(logger.logError).toHaveBeenCalled();
            expect(res.send).toHaveBeenCalledWith({ error: true });
        });
    });
});
