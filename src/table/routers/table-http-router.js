import { HttpRouter } from "./../../core/routers/";

export default class TableHttpRouter extends HttpRouter {
    collectOnlineUsers() {
        const realOnlineUsers = this.collectOnlineUsers();
        const bots = Object.values(this.gameData.players)
            .filter((player) => player.type)
            .map((bot) => ({ name: bot.name, red: bot.red }));

        return {
            ...realOnlineUsers,
            bots,
            totalBots: bots.length,
        };
    }
}
