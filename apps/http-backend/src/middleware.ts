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
    const token = req.headers["authorization"] ?? "";
    
    const decoded = jwt.verify(token, JwT_SECRET) as CustomJwtPayload;

    if (decoded) {
        req.userId = decoded.userId;
        next();
    }
    else {
        res.status(403).json({
            message: "Unauthorized"
        })
    }
}