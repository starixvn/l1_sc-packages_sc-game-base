import { userInfos } from "sc-base-database";

export const resetInRoom = async (gameName) => {
    await userInfos.updateMany({ type: true, inGameRoom: gameName }, { inRoom: false, inGameRoom: "" });
};
