import mongoose from "mongoose";

const schema = new mongoose.Schema({
    name: { type: String, require: true },
    code: { type: String, require: true },
    multiplier: { type: Number, require: true },
    enabled: { type: Boolean, require: true },
    isTest: { type: Boolean, require: true },
    partnerId: { type: String, require: true },
    groupId: { type: mongoose.Types.ObjectId, require: true },
    isUncountOnTotal: { type: Boolean, require: false },
    operatorId: { type: String, require: true },
});

export default mongoose.model("currencies", schema);
