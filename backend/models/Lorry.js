import mongoose from "mongoose";

const lorrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    companyId: { type: String, required: true, index: true },
    vehicleNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    driverId: { type: String, required: true },
    capacityGrams: { type: Number, required: true, min: 1 },
    areas: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, strict: "throw", collection: "lorries" },
);

export default mongoose.models.WorkflowLorry || mongoose.model("WorkflowLorry", lorrySchema);
