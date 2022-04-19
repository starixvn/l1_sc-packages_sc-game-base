import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
    roundId: { type: Number, required: true },
    encryptedResultHash: { iv: { type: String }, content: { type: String } },
    encryptedResult: { iv: { type: String }, content: { type: String } },
    time: { type: Date, default: new Date() },
});

export default resultSchema;
