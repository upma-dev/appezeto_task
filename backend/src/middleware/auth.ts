import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "interview_secret_helpdesk_key_99";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    agentName?: string | null;
  };
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(403).json({ message: "User not found or suspended." });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      agentName: user.agentName
    };
    
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
}

// Middleware to specify allowed roles
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized." });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Requires one of these roles: ${roles.join(", ")}` });
    }
    
    next();
  };
}
