import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "agent", "customer"], default: "customer" },
    agentName: { type: String, default: null } // Link to "Riya", "Karan", or "Dev" if role is agent
  },
  { timestamps: true }
);

export const User = (mongoose.models.User || mongoose.model("User", UserSchema)) as any;
