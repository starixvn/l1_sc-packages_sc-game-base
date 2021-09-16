import { createContainer } from "awilix";
import { stub } from "jest-micro-auto-stub";
import { logger } from "sc-common";

import BaseGameStartup from "../base-game-startup";
import { authenticationHelpers } from "../helpers";
import BaseAdminSocketRouter from "../routers/base-admin-socket-router";
import BaseSocketRouter from "../routers/base-socket-router";
import HttpRouter from "../routers/http-router";

jest.mock("sc-common");
jest.mock("sc-base-database");
jest.mock("../helpers");

describe("base game startup test", () => {
    const container = createContainer();
    logger.start.mockReturnValue(jest.fn());
    authenticationHelpers.init.mockReturnValue(jest.fn());

    const socketClient = {
        emit: jest.fn(),
    };

    it("initSocketRouter_always_init router", () => {
        /** @type {BaseSocketRouter} */
        const router = stub(BaseSocketRouter);
        spyOn(container, "resolve").and.returnValue(router);
        const baseGameStartup = new BaseGameStartup(container);

        // act
        baseGameStartup.initSocketRouter(socketClient);

        // assert
        expect(router.init).toHaveBeenCalled();
    });

    it("initAdminSocketRouter_always_init router", () => {
        /** @type {BaseAdminSocketRouter} */
        const router = stub(BaseAdminSocketRouter);
        spyOn(container, "resolve").and.returnValue(router);
        const baseGameStartup = new BaseGameStartup(container);

        //act
        baseGameStartup.initAdminSocketRouter(socketClient);

        // assert
        expect(router.init).toHaveBeenCalled();
    });

    it("initHttpRouter_always_init router", () => {
        /** @type {HttpRouter} */
        const router = stub(HttpRouter);
        spyOn(container, "resolve").and.returnValue(router);
        const baseGameStartup = new BaseGameStartup(container);

        //act
        baseGameStartup.initHttpRouter(socketClient);

        // assert
        expect(router.init).toHaveBeenCalled();
    });
});
