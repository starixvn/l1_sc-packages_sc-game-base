const tempBetBaseSchema = {
    uid: { type: String, required: true },
    name: { type: String, required: true },

    betwin: { type: Number, default: 0 },
    time: { type: Date },
    odds: { type: Object },

    clientSeed: { type: String, default: "" },
    siteId: { type: String },
    freeBet: { type: Boolean, default: false },

    playerId: { type: String },
    operatorId: { type: String, required: false },
    roundId: { type: Number, default: 0, required: true },
    paid: { type: Boolean, default: false },
};

const betBaseSchema = {
    ...tempBetBaseSchema,
    currency: { type: String },
    rate: { type: Number, required: true },
    totalAmount: { type: Number, default: 0 },
};
export { betBaseSchema, tempBetBaseSchema };

