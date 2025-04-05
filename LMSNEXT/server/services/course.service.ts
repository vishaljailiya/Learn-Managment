import { Response } from "express";
import CourseModel from "../Models/course.model";
import { CatchAsyncError } from "../Middleware/CatchAsyncError";

export const creatCourse = CatchAsyncError(async (data: any, res: Response) => {
  const course = await CourseModel.create(data);
  res.status(200).json({
    success: true,
    course,
  });
});
