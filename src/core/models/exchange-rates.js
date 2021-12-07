import mongoose from "mongoose";

const schema = new mongoose.Schema({
    exId: { type: Number, require: true },
    time: { type: Date, require: true },
    source: { type: String, require: true },
    code: { type: Object, require: true },
});

export default mongoose.model("exchange_rates", schema);
