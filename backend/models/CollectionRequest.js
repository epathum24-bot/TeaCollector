import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    number: String,
    requestNumber: String,
    collectorName: String,
    grossGrams: Number,
    rejectedGrams: Number,
    otherDeductionGrams: Number,
    netGrams: Number,
    pricePerKgAtCollection: Number,
    pricePerKgCents: Number,
    totalCents: Number,
    note: String,
    issuedAt: String,
    recordedBy: String,
    paymentStatus: { type: String, enum: ["unpaid", "paid"] },
    paidAt: String,
    paidBy: String,
    paymentReference: String,
    settlementNumber: String,
    // Legacy bill fields retained so older bills can still be opened and paid.
    weightGrams: Number,
    acceptedGrams: Number,
    rateCents: Number,
    grossCents: Number,
    deductionCents: Number,
  },
  { _id: false, strict: "throw" },
);

const requestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    // Matches the existing MongoDB requestNumber_1 index.
    requestNumber: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    lorryId: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
    ownerPhone: { type: String, required: true },
    companyName: { type: String, required: true },
    companyPhone: { type: String, required: true },
    vehicleNumber: { type: String, required: true },
    date: { type: String, required: true },
    timeWindow: { type: String, required: true },
    area: { type: String, required: true },
    location: { type: String, required: true },
    notes: { type: String, default: "" },
    estimatedGrams: { type: Number, required: true, min: 1 },
    rateCents: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "assigned",
        "on_the_way",
        "collected",
        "completed",
        "paid",
        "rejected",
        "cancelled",
        // Keep reading older records created before the lifecycle update.
        "requested",
      ],
      required: true,
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    bill: { type: billSchema, default: undefined },
  },
  { versionKey: false, strict: "throw", collection: "requests" },
);
requestSchema.index({ lorryId: 1, date: 1, status: 1 });

export default mongoose.models.CollectionRequest || mongoose.model("CollectionRequest", requestSchema);
