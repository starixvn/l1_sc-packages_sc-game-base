import { mongoose } from "sc-instrument-helper";

const modelName = "archive_statuses";

const archiveStatusSchema = new mongoose.Schema({
    name: { type: String, required: true },
    lastArcRoundId: { type: Number, required: true },
});

export default mongoose.model(modelName, archiveStatusSchema);
