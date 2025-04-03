require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../Models/User.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../Middleware/CatchAsyncError";
import jwt, { Secret, JwtPayload } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/SendMail";
import {
  refreshTokenOptions,
  accessTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { stat } from "fs";
import { getUserById } from "../services/user.services";
import cloudinary from "cloudinary";

// register user
interface IRegisterationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registerationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler(400, "Email already exist"));
      }

      const user: IRegisterationBody = {
        name,
        email,
        password,
      };

      const activationToken = createActivationToken(user);
      const activationCode = activationToken.activationCode;
      const data = { user: user.name, activationCode };
      const html = await ejs.renderFile(
        path.join(__dirname, "../Mails/activation-mail.ejs"),
        data
      );

      try {
        await sendMail({
          email: user.email,
          subject: "Activation your account",
          template: "activation-mail.ejs",
          data,
        });

        res.status(201).json({
          success: true,
          message: ` Please check your email:${user.email} to activate your account`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(400, error.message));
      }
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    { user, activationCode },
    process.env.ACTIVATION_SECRET as Secret, // Ensure this is defined in .env
    { expiresIn: "1h" }
  );

  return { token, activationCode };
};

// Activate user
interface IActivationRequest {
  activation_Code: string;
  activation_Token: string;
}

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_Code, activation_Token } =
        req.body as IActivationRequest;

      if (!activation_Code || !activation_Token) {
        return next(
          new ErrorHandler(400, "Activation code and token are required")
        );
      }

      let newUser;
      try {
        newUser = jwt.verify(
          activation_Token,
          process.env.ACTIVATION_SECRET as Secret
        ) as { user: IUser; activationCode: string };
      } catch (error: any) {
        return next(
          new ErrorHandler(400, "Invalid or expired activation token")
        );
      }

      if (newUser.activationCode !== activation_Code) {
        return next(new ErrorHandler(400, "Invalid activation code"));
      }

      const { name, email, password } = newUser.user;

      const existingUser = await userModel.findOne({ email });

      if (existingUser) {
        return next(new ErrorHandler(400, "User already exists"));
      }

      await userModel.create({ name, email, password });

      res.status(201).json({
        success: true,
        message: "Account activated successfully",
      });
    } catch (error: any) {
      return next(
        new ErrorHandler(500, "Something went wrong: " + error.message)
      );
    }
  }
);
// login user

interface ILoginRequiest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequiest;

      if (!email || !password) {
        return next(new ErrorHandler(400, "Please enter email and password"));
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler(400, "Invalid email or password"));
      }

      const isPasswordMatch = await user.comparePassword(password);

      if (!isPasswordMatch) {
        return next(new ErrorHandler(400, "Invalid email or password"));
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // ✅ Correct way to clear cookies
      res.cookie("access_token", "", {
        httpOnly: true,
        expires: new Date(0), // ⚡ Instantly expire cookie
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      res.cookie("refresh_token", "", {
        httpOnly: true,
        expires: new Date(0), // ⚡ Instantly expire cookie
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      // ✅ Remove user session from Redis
      const userId = req.user?._id || "";
      if (userId) {
        const result = await redis.del(`user:${userId}`);
        if (result === 0) {
          console.log(`User session not found in Redis for user ID: ${userId}`);
        } else {
          console.log(`User session deleted from Redis for user ID: ${userId}`);
        }
      } else {
        console.log("User ID not found in request");
      }

      // ✅ Send response
      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Error during logout:", error);
      return next(new ErrorHandler(500, "Internal Server Error"));
    }
  }
);

//validate user role
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

// updatte access token
export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token;

      if (!refresh_token) {
        return next(
          new ErrorHandler(401, "Please log in to access this resource")
        );
      }

      // ✅ Verify Refresh Token
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      if (!decoded || !decoded.id) {
        return next(new ErrorHandler(401, "Invalid refresh token"));
      }

      // ✅ Get User Session from Redis
      const session = await redis.get(`user:${decoded.id}`);
      if (!session) {
        return next(new ErrorHandler(401, "User not found"));
      }

      const user = JSON.parse(session);

      // ✅ Generate New Access Token
      const access_token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.ACCESS_TOKEN as string,
        { expiresIn: "1hr" } // ⬅️ Increased expiry for better UX
      );

      // ✅ Keep the same refresh token, unless it's near expiry
      const refreshTokenExpiry = new Date(decoded.exp! * 1000);
      const now = new Date();
      let refresh_token_new = refresh_token;

      if (refreshTokenExpiry.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
        // 🔹 If less than 1 day left, generate new refresh token
        refresh_token_new = jwt.sign(
          { id: user._id },
          process.env.REFRESH_TOKEN as string,
          { expiresIn: "3d" }
        );
        res.cookie("refresh_token", refresh_token_new, refreshTokenOptions);
      }

      // ✅ Set new access token
      res.cookie("access_token", access_token, accessTokenOptions);

      // ✅ Send response
      res.status(200).json({
        status: "success",
        access_token,
        refresh_token: refresh_token_new, // ⬅️ Only new token if changed
      });
    } catch (error) {
      return next(new ErrorHandler(401, "Invalid or expired refresh token"));
    }
  }
);

// get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(
          new ErrorHandler(401, "Please login to access this resource")
        );
      }

      console.log("Debug - User from request:", req.user);
      const userId = req.user._id;
      console.log("Debug - User ID:", userId);

      if (!userId) {
        return next(new ErrorHandler(400, "User ID not found"));
      }

      // Ensure userId is a string and properly formatted
      const userIdString = userId.toString();
      console.log("Debug - User ID as string:", userIdString);

      await getUserById(userIdString, res);
    } catch (error: any) {
      console.error("Error in getUserInfo:", error);
      return next(
        new ErrorHandler(500, error.message || "Error fetching user info")
      );
    }
  }
);

// Social Authentication
interface ISocialAuthBody {
  email: string;
  name: string;
  avatar?: string;
}

export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;

      if (!email || !name) {
        return next(
          new ErrorHandler(400, "Please provide all required fields")
        );
      }

      const user = await userModel.findOne({ email });

      if (user) {
        // User exists, send token
        sendToken(user, 200, res);
      } else {
        // Create new user
        const newUser = await userModel.create({
          email,
          name,
          avatar,
        });

        sendToken(newUser, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(500, error.message));
    }
  }
);

// update user info

interface IUpdateUserInfo {
  name?: string;
  email?: string;
  password?: string;
  avatar?: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email } = req.body as IUpdateUserInfo;
      const userId = req.user?._id;
      const user = await userModel.findById(userId);
      if (email && user) {
        const existingEmail = await userModel.findOne({ email });
        if (existingEmail) {
          return next(new ErrorHandler(400, "Email already exists"));
        }
        user.email = email;
      }
      if (name && user) {
        user.name = name;
      }
      await user?.save();
      await redis.set(`user:${userId}`, JSON.stringify(user));
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(500, error.message));
    }
  }
);

// update user password

interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;
      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler(400, "Please enter old and new password"));
      }

      const user = await userModel.findById(req.user?._id).select("+password");
      if (user?.password === undefined) {
        return next(new ErrorHandler(400, "Invailid user"));
      }
      const isPasswordMatch = await user?.comparePassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler(400, "Invalid old password"));
      }
      user.password = newPassword;
      await user?.save();
      await redis.set(`user:${req.user?._id}`, JSON.stringify(user));
      res.status(200).json({
        success: true,
        user,
        message: "Password updated successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(500, error.message));
    }
  }
);

interface IUpdateProfilePicture {
  avatar: {
    public_id: string;
  };
}

// update profile picture
export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body;

      const userId = req.user?._id;

      const user = await userModel.findById(userId);

      if (avatar && user) {
        // if user have one avatar than call this if
        if (user?.avatar?.public_id) {
          // first delete the old image
          await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });

          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } else {
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });

          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        }
      }

      await user?.save();
      await redis.set(`user:${userId}`, JSON.stringify(user));
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(500, error.message));
    }
  }
);
