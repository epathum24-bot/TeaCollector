import mongoose from "mongoose";

const requestSequenceSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, collection: "request_sequences" },
);

export default mongoose.models.RequestSequence ||
  mongoose.model("RequestSequence", requestSequenceSchema);
