require("dotenv").config();
import mongoose, { Document, model, Schema } from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar: {
    public_id: string;
    url: string;
  };
  role: string;
  isVerified: boolean;
  courses: Array<{ courseId: string }>;
  comparePassword: (password: string) => Promise<boolean>;
  SignAccessToken: () => string;
  SignRefreshToken: () => string;
}

const userSchema: Schema<IUser> = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter your name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please enter your email"],
      validate: {
        validator: function (value: string) {
          return emailRegexPattern.test(value);
        },
        message: (props: any) => `${props.value} is not a valid email address`,
      },
      unique: true,
    },
    password: {
      type: String,
      minlength: [6, "Your password must be longer than 6 characters"],
      select: false,
    },
    avatar: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    role: {
      type: String,
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    courses: [
      {
        courseId: {
          type: Schema.Types.ObjectId,
          ref: "Course",
        },
      },
    ],
  },
  { timestamps: true }
);

// 🛠 Hash password before saving
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// 🛠 Sign Access Token
userSchema.methods.SignAccessToken = function (): string {
  if (!process.env.ACCESS_TOKEN) {
    console.error("❌ ACCESS_TOKEN secret is missing in .env file");
    throw new Error("ACCESS_TOKEN secret is missing");
  }

  return jwt.sign(
    { id: this._id.toString(), role: this.role },
    process.env.ACCESS_TOKEN,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "5m" } // Default: 5 minutes
  );
};

// 🛠 Sign Refresh Token
userSchema.methods.SignRefreshToken = function (): string {
  if (!process.env.REFRESH_TOKEN) {
    console.error("❌ REFRESH_TOKEN secret is missing in .env file");
    throw new Error("REFRESH_TOKEN secret is missing");
  }

  return jwt.sign(
    { id: this._id.toString(), role: this.role },
    process.env.REFRESH_TOKEN,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "7d" } // Default: 7 days
  );
};

// 🛠 Compare user password
userSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
  return await bcryptjs.compare(enteredPassword, this.password);
};

const userModel = model<IUser>("User", userSchema);

export default userModel;
