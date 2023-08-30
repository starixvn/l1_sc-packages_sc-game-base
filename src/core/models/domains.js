import { mongoose } from "sc-instrument-helper";

const modelName = "domains";

const schema = new mongoose.Schema({
    value: { type: String, required: true },
});

export default mongoose.model(modelName, schema);
