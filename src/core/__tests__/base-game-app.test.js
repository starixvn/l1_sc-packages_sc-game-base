import { createContainer } from "awilix";
import { stub } from "jest-micro-auto-stub";

import BaseGameApp from "../base-game-app";
import BaseGameStartup from "../base-game-startup";

describe("base game app test", () => {
    const container = createContainer();
    /** @type {BaseGameStartup} */
    const startup = stub(BaseGameStartup);

    const baseGameApp = new BaseGameApp(container, startup);

    it("run_always_calls specific methods", async () => {
        // act
        await baseGameApp.run();

        // assert
        expect(startup.configureServices).toHaveBeenCalled();
        expect(startup.startServer).toHaveBeenCalled();
    });
});
