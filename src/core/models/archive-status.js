import mongoose from "mongoose";

const modelName = "archive_statuses";

const archiveStatusSchema = new mongoose.Schema({
    name: { type: String, required: true },
    last_round_id: { type: Number, required: true },
});

export default mongoose.model(modelName, archiveStatusSchema);
