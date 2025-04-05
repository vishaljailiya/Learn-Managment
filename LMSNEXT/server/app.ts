import "dotenv/config"; // ✅ Ensure Environment Variables Load First

import express, { NextFunction, Request, Response } from "express";
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./Middleware/error";
import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.route";
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
app.use("/api/v1", userRouter);
app.use("/api/v1", courseRouter);

// ✅ API Testing Route
app.get("/test", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    success: true,
    message: "API is working",
  });
});

// ✅ Handle Unknown Routes
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

// ✅ Global Error Middleware
app.use(ErrorMiddleware);
