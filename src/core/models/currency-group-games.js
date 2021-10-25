import mongoose from "mongoose";

const schema = new mongoose.Schema({
    groupId: { type: String, require: true },
    gameId: { type: Number, require: true },
    gameName: { type: String, require: true },
    enabled: { type: Boolean, require: true },
    minBet: { type: Number, require: true },
    maxBet: { type: Number, require: true },
    maxBetPerChoices: { type: Object, require: true },
    chips: [{ text: String, value: Number, color: String }],
});

export default mongoose.model("currency_group_games", schema);
