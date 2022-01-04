import mongoose from "mongoose";

const modelName = "partner_config";

const Schema = new mongoose.Schema({
    type: { type: String, required: true },
    partnerId: { type: String, required: true },
    value: { type: Object },
});

export default mongoose.model(modelName, Schema);
