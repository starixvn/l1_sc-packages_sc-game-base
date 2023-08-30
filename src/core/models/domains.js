import { mongoose } from "mongoose";

const modelName = "domains";

const schema = new mongoose.Schema({
    value: { type: String, required: true },
});

export default mongoose.model(modelName, schema);
