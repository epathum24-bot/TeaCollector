import mongoose from "mongoose";

const monthlySettlementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    number: { type: String, required: true, unique: true },
    companyId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
    companyName: { type: String, required: true },
    month: { type: String, required: true },
    requestIds: { type: [String], required: true },
    requestNumbers: { type: [String], required: true },
    requestCount: { type: Number, required: true, min: 1 },
    totalCents: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "paid"], required: true },
    paymentReference: String,
    createdAt: { type: String, required: true },
    paidAt: String,
    paidBy: String,
  },
  { versionKey: false, strict: "throw", collection: "monthly_settlements" },
);

monthlySettlementSchema.index({ companyId: 1, ownerId: 1, month: 1 }, { unique: true });

export default mongoose.models.MonthlySettlement ||
  mongoose.model("MonthlySettlement", monthlySettlementSchema);
