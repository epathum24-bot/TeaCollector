import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["owner", "company", "collector"], required: true },
    companyId: { type: String, index: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, strict: "throw", collection: "users" },
);

export default mongoose.models.WorkflowUser || mongoose.model("WorkflowUser", userSchema);
