import mongoose from "mongoose";

const schema = new mongoose.Schema({
    partnerId: { type: String, require: true },
    name: { type: String, require: true },
    secretKey: { type: String, require: true },
    clubVersionUrl: { type: String, require: true },
    mobiVersionUrl: { type: String },
    miniVersionUrl: { type: String },
    testCurrencyUrl: { type: String, require: true },
});

export default mongoose.model("partners", schema);
