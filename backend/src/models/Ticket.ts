import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  text: { type: String, required: true },
  author: { type: String, required: true },
  authorRole: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const HistorySchema = new mongoose.Schema({
  action: { type: String, required: true },
  by: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: String, default: "" }
});

const TicketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["Bug", "Feature", "Billing", "Other"],
      required: true
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      required: true
    },
    status: {
      type: String,
      enum: ["Queued", "Open", "In Progress", "Resolved", "Closed"],
      required: true
    },
    version: { type: Number, default: 1 },
    assignedAgent: { type: String, default: null }, // Riya, Karan, Dev or null
    slaDeadline: { type: Date, required: true },
    priorityBumped: { type: Boolean, default: false }, // track if priority has already been bumped due to SLA breach
    createdByUserId: { type: String, required: true },
    createdByUserName: { type: String, required: true },
    comments: [CommentSchema],
    history: [HistorySchema]
  },
  { timestamps: true }
);

export const Ticket = (mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema)) as any;
