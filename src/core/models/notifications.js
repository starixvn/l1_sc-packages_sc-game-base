import mongoose from "mongoose";

const modelName = "notification";

const schema = new mongoose.Schema({
    time: { type: Date, required: true },
    message: { type: String, required: true },
    displayKind: { type: Number, required: true },
    gameName: { type: String, required: true },
    messages: { type: Object, required: true },
});

export default mongoose.model(modelName, schema);
