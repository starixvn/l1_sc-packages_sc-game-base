import mongoose from "mongoose";

const schema = new mongoose.Schema({
    name: { type: String, require: true },
    enabled: { type: Boolean, require: true },
    partnerId: { type: String, require: true },
    operatorId: { type: String, require: true },
});

export default mongoose.model("currency_groups", schema);
