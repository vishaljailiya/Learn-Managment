require("dotenv").config();
import { Response } from "express";
import { redis } from "./redis";
import { IUser } from "../Models/User.model";

interface ITokenoptions {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  secure?: boolean;
  sameSite: "lax" | "strict" | "none" | undefined;
}

// ✅ Correct Expiry Calculation (milliseconds)
export const accessTokenExpire =
  parseInt(process.env.ACCESS_TOKEN_EXPIRE || "15", 10) * 60 * 1000; // 15 min
const refreshTokenExpire =
  parseInt(process.env.REFRESH_TOKEN_EXPIRE || "7", 10) * 24 * 60 * 60 * 1000; // 7 days

export const accessTokenOptions: ITokenoptions = {
  expires: new Date(Date.now() + accessTokenExpire),
  maxAge: accessTokenExpire,
  httpOnly: true,
  sameSite: "lax",
};

export const refreshTokenOptions: ITokenoptions = {
  expires: new Date(Date.now() + refreshTokenExpire),
  maxAge: refreshTokenExpire,
  httpOnly: true,
  sameSite: "lax",
};

// ✅ Secure Flag for Production
if (process.env.NODE_ENV === "production") {
  accessTokenOptions.secure = true;
  refreshTokenOptions.secure = true;
  accessTokenOptions.sameSite = "none"; // Required for cross-site cookies
  refreshTokenOptions.sameSite = "none";
}

export const sendToken = async (
  user: IUser,
  statusCode: number,
  res: Response
) => {
  try {
    const accessToken = user.SignAccessToken();
    const refreshToken = user.SignRefreshToken();

    // Create a user object with all necessary information
    const userForRedis = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      courses: user.courses,
      avatar: user.avatar,
      SignAccessToken: user.SignAccessToken,
      SignRefreshToken: user.SignRefreshToken,
    };

    // Store complete user data in Redis
    await redis.set(
      `user:${user._id}`,
      JSON.stringify(userForRedis),
      "EX",
      7 * 24 * 60 * 60 // 7 days in seconds
    );

    console.log("✅ Complete user session stored in Redis successfully.");

    // Set Cookies
    res.cookie("access_token", accessToken, accessTokenOptions);
    res.cookie("refresh_token", refreshToken, refreshTokenOptions);

    res.status(statusCode).json({
      success: true,
      user,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("❌ Error saving session to Redis:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
