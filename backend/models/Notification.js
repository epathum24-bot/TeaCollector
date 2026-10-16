import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    recipientId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    requestId: { type: String },
    requestNumber: { type: String },
    read: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, strict: "throw", collection: "notifications" },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });

export default mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
