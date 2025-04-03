import "dotenv/config"; // ✅ Ensure Environment Variables Load First

import express, { NextFunction, Request, Response } from "express";
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./Middleware/error";
import userRouter from "./routes/user.route";
import ErrorHandler from "./utils/ErrorHandler";

// ✅ Load Body Parser First
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// ✅ CORS Handling (Multiple Origins)
const allowedOrigins = process.env.ORIGIN?.split(",") || [
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ API Routes
app.use("/api/user", userRouter);

// ✅ API Testing Route
app.get("/test", (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Hello World" });
});

// ✅ Handle Unknown Routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  next(new ErrorHandler(404, `Route not found - ${req.originalUrl}`));
});

// ✅ Global Error Middleware
app.use(ErrorMiddleware);
