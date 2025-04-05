require("dotenv").config();
import { Response, Request, NextFunction } from "express";
import { CatchAsyncError } from "./CatchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";
import { accessTokenOptions, refreshTokenOptions } from "../utils/jwt";
import { IUser } from "../Models/User.model";
import userModel from "../Models/User.model";

interface CustomJwtPayload extends JwtPayload {
  id: string;
  role: string;
}

// ✅ Authenticate Middleware with Proper Debugging
export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const access_token = req.cookies?.access_token;
      const refresh_token = req.cookies?.refresh_token;

      if (!access_token) {
        if (!refresh_token) {
          return next(
            new ErrorHandler(401, "Please login to access this resource")
          );
        }

        // Try to refresh the access token
        const decoded = jwt.verify(
          refresh_token,
          process.env.REFRESH_TOKEN as string
        ) as CustomJwtPayload;

        const user = await redis.get(`user:${decoded.id}`);

        if (!user) {
          return next(new ErrorHandler(401, "Please login again"));
        }

        const userData = JSON.parse(user);
        const accessToken = jwt.sign(
          { id: userData._id, role: userData.role },
          process.env.ACCESS_TOKEN as string,
          {
            expiresIn: "15m",
          }
        );

        res.cookie("access_token", accessToken, accessTokenOptions);
        req.user = userData;
        return next();
      }

      // Verify access token
      try {
        const decoded = jwt.verify(
          access_token,
          process.env.ACCESS_TOKEN as string
        ) as CustomJwtPayload;

        const user = await redis.get(`user:${decoded.id}`);

        if (!user) {
          return next(
            new ErrorHandler(401, "Please login to access this resource")
          );
        }

        req.user = JSON.parse(user);
        next();
      } catch (error) {
        // If access token is expired, try refresh token
        if (!refresh_token) {
          return next(
            new ErrorHandler(401, "Please login to access this resource")
          );
        }

        const decoded = jwt.verify(
          refresh_token,
          process.env.REFRESH_TOKEN as string
        ) as CustomJwtPayload;

        const user = await redis.get(`user:${decoded.id}`);

        if (!user) {
          return next(new ErrorHandler(401, "Please login again"));
        }

        const userData = JSON.parse(user);
        const accessToken = jwt.sign(
          { id: userData._id, role: userData.role },
          process.env.ACCESS_TOKEN as string,
          {
            expiresIn: "15m",
          }
        );

        res.cookie("access_token", accessToken, accessTokenOptions);
        req.user = userData;
        next();
      }
    } catch (error: any) {
      return next(
        new ErrorHandler(401, "Please login to access this resource")
      );
    }
  }
);

// validate user role
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(
        new ErrorHandler(
          403,
          `Role (${req.user?.role}) is not allowed to access this resource`
        )
      );
    }
    next();
  };
};
