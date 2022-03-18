import mongoose from "mongoose";

const schema = new mongoose.Schema({
    roundId: { type: Number, required: true },
    encryptedMD5: { iv: { type: String }, content: { type: String } },
    encryptedResult: { iv: { type: String }, content: { type: String } },
    time: { type: Date, default: new Date() },
});

export default schema;
