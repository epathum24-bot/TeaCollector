import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    areas: { type: [String], default: [] },
    rateCents: { type: Number, default: 0, min: 0 },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, strict: "throw", collection: "companies" },
);

export default mongoose.models.WorkflowCompany || mongoose.model("WorkflowCompany", companySchema);
