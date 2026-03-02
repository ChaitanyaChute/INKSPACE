import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JwT_SECRET } from "@repo/backend-common/config"

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

interface CustomJwtPayload extends JwtPayload {
    userId: string;
}

export function middleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"];
    
    if (!authHeader) {
        return res.status(403).json({
            message: "No authorization header"
        });
    }

    const token = authHeader.startsWith("Bearer ") 
        ? authHeader.substring(7) 
        : authHeader;

    try {
        const decoded = jwt.verify(token, JwT_SECRET) as unknown as CustomJwtPayload;
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(403).json({
            message: "Invalid or expired token"
        });
    }
}