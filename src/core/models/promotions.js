import { mongoose } from "sc-instrument-helper";

const modelName = "promotion";

const schema = new mongoose.Schema({
    gameId: { type: Number, required: true },
    odds: { type: Object, required: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    status: { type: String, required: true },
    isDaily: { type: Boolean, required: true },
});

export default mongoose.model(modelName, schema);
