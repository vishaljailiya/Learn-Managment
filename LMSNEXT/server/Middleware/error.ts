import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";

export const ErrorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  // Wrong Mongoose ID Error
  if (err.name === "CastError") {
    const message = `Resource not found. Invalid: ${err.path}`;
    err = new ErrorHandler(404, message);
  }

  // Duplicate key error
  if (err.code === 11000) {
    const message = `Duplicate ${Object.keys(err.keyValue)} entered`;
    err = new ErrorHandler(400, message);
  }

  // JWT Expired Error
  if (err.name === "TokenExpiredError") {
    const message = "Json Web Token is expired. Try Again!!!";
    err = new ErrorHandler(401, message);
  }

  // JWT Error
  if (err.name === "JsonWebTokenError") {
    const message = "Json Web Token is invalid. Try Again!!!";
    err = new ErrorHandler(401, message);
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};
