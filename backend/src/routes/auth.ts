import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "interview_secret_helpdesk_key_99";

// Register a new user
router.post("/register", async (req, res): Promise<any> => {
  const { name, email, password, role, agentName } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required." });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "customer",
      agentName: role === "agent" ? agentName : null
    });

    await newUser.save();

    // Create JWT
    const token = jwt.sign({ id: newUser._id, email: newUser.email, role: newUser.role }, JWT_SECRET, {
      expiresIn: "1d"
    });

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        agentName: newUser.agentName
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Login User
router.post("/login", async (req, res): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    // Create JWT
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, {
      expiresIn: "1d"
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        agentName: user.agentName
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get Current User info
router.get("/me", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  res.json({ user: req.user });
});

// Get all users (Admin only)
router.get("/users", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin privileges required." });
  }
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Update user role and capabilities (Admin only)
router.patch("/users/:id/role", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin privileges required." });
  }
  const { role, agentName } = req.body;
  if (!role) {
    return res.status(400).json({ message: "Role parameter is required." });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    user.role = role;
    if (role === "agent") {
      user.agentName = agentName || "Riya";
    } else {
      user.agentName = null;
    }
    await user.save();
    res.json({ 
      message: "User privileges amended successfully.", 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        agentName: user.agentName
      } 
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
