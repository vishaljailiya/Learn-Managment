require("dotenv").config();
import { Response, Request, NextFunction } from "express";
import { CatchAsyncError } from "./CatchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";
import { accessTokenOptions } from "../utils/jwt";
import { IUser } from "../Models/User.model";
import userModel from "../Models/User.model";

interface CustomJwtPayload extends JwtPayload {
  id: string;
  role: string;
}

// ✅ Authenticate Middleware with Proper Debugging
export const isAuthenticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("🔹 Received Cookies:", req.cookies);

    const access_token = req.cookies?.access_token;
    const refresh_token = req.cookies?.refresh_token;

    if (!access_token) {
      console.log("❌ No access token found. User needs to log in.");
      return next(
        new ErrorHandler(401, "Please log in to access this resource")
      );
    }

    try {
      console.log("🔹 Verifying Access Token...");
      const decoded = jwt.verify(
        access_token,
        process.env.ACCESS_TOKEN as string
      ) as CustomJwtPayload;

      // Ensure Redis Connection is Working
      if (!redis) {
        console.error("❌ Redis connection failed!");
        return next(new ErrorHandler(500, "Internal Server Error"));
      }

      // Fetch user session from Redis
      const userSession = await redis.get(`user:${decoded.id}`);
      if (!userSession) {
        console.log("❌ User session expired or invalid in Redis.");
        return next(
          new ErrorHandler(401, "User session expired. Please log in again.")
        );
      }

      const userData = JSON.parse(userSession);
      // Create a new document instance to get access to methods
      const user = new userModel(userData);
      req.user = user;

      console.log("✅ User authenticated successfully:", req.user);
      return next();
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        console.error("❌ Access Token expired. Checking Refresh Token...");

        if (!refresh_token) {
          console.log("❌ No refresh token found. Authentication failed.");
          return next(new ErrorHandler(401, "Invalid or expired access token"));
        }

        try {
          console.log("🔹 Verifying Refresh Token...");
          const decoded = jwt.verify(
            refresh_token,
            process.env.REFRESH_TOKEN as string
          ) as CustomJwtPayload;

          // Check Redis session again for refresh token
          const userSession = await redis.get(`user:${decoded.id}`);
          if (!userSession) {
            console.log("❌ Refresh token session expired in Redis.");
            return next(
              new ErrorHandler(
                401,
                "Refresh token expired. Please log in again."
              )
            );
          }

          const userData = JSON.parse(userSession);
          // Create a new document instance to get access to methods
          const user = new userModel(userData);

          const newAccessToken = user.SignAccessToken();

          // Ensure cookie options exist
          if (!accessTokenOptions) {
            console.error("❌ accessTokenOptions is not defined!");
            return next(new ErrorHandler(500, "Internal Server Error"));
          }

          // Set new access token
          res.cookie("access_token", newAccessToken, accessTokenOptions);
          console.log("✅ New Access Token generated and set in cookies.");

          req.user = user;
          return next();
        } catch (refreshError: any) {
          console.error("❌ Refresh Token error:", refreshError.message);
          return next(
            new ErrorHandler(401, "Invalid or expired refresh token")
          );
        }
      } else {
        console.error("❌ Error verifying token:", err.message);
        return next(new ErrorHandler(401, "Invalid or expired token"));
      }
    }
  }
);

// export const isAuthenticated = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const access_token = req.cookies.access_token as string;

//     if (!access_token) {
//       return next(
//         new ErrorHandler(401, "Please log in to access this resource")
//       );
//     }

//     const decode = jwt.verify(
//       access_token,
//       process.env.ACCESS_TOKEN as string
//     ) as JwtPayload;

//     if (!decode) {
//       return next(new ErrorHandler(400, "access token is not valid"));
//     }

//     const user = await redis.get(decode.id);

//     if (!user) {
//       return next(new ErrorHandler(400, "user not found"));
//     }

//     req.user = JSON.parse(user);

//     next();
//   }
// );
