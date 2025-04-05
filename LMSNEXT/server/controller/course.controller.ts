import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../Middleware/CatchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import CourseModel, { ICourse } from "../Models/course.model";
import { redis } from "../utils/redis";
import userModel from "../Models/User.model";
import mongoose from "mongoose";
import { Document } from "mongoose";

// Configure cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET_KEY,
});

// upload course

// export const uploadCourse = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const data = req.body;
//       const thumbnail = data.thumbnail;
//       if (thumbnail) {
//         const mycloud = await cloudinary.v2.uploader.upload(thumbnail, {
//           folder: "courses",
//         });

//         data.thambnail = {
//           public_id: mycloud.public_id,
//           url: mycloud.secure_url,
//         };
//       }
//       creatCourse(data, res, next);
//     } catch (error: any) {
//       return next(new ErrorHandler(500, error.message));
//     }
//   }
// );

// create course
export const createCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      // Log the incoming data
      console.log("Incoming course data:", data);

      // Validate required fields
      if (!data.name || !data.description || !data.price) {
        return next(
          new ErrorHandler(400, "Please provide all required fields")
        );
      }

      const thumbnail = data.thumbnail;

      if (thumbnail) {
        try {
          const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
            folder: "courses",
          });

          data.thumbnail = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } catch (error: any) {
          console.error("Cloudinary upload error:", error);
          return next(new ErrorHandler(500, "Error uploading thumbnail"));
        }
      }

      // Create course
      console.log("Creating course with data:", data);
      const course = (await CourseModel.create(data)) as ICourse & {
        _id: mongoose.Types.ObjectId;
      };

      // Add course to user's courses array
      if (req.user && req.user._id) {
        console.log("Updating user's courses array for user:", req.user._id);
        const user = await userModel.findById(req.user._id);
        if (user) {
          const courseId = course._id.toString();
          user.courses.push({ courseId });
          await user.save();

          // Update user in Redis
          await redis.set(`user:${user._id}`, JSON.stringify(user.toJSON()));

          // Also update the user's courses in Redis
          console.log("Updated user courses:", user.courses);
        }
      }

      // Update redis cache for courses
      try {
        const coursesData = await redis.get("courses");
        const courseJSON = course.toJSON();
        if (coursesData) {
          const parsedCourses = JSON.parse(coursesData);
          await redis.set(
            "courses",
            JSON.stringify([...parsedCourses, courseJSON])
          );
        } else {
          await redis.set("courses", JSON.stringify([courseJSON]));
        }
      } catch (error: any) {
        console.error("Redis cache error:", error);
        // Don't return here, as the course is already created
      }

      res.status(201).json({
        success: true,
        message: "Course created successfully",
        course,
      });
    } catch (error: any) {
      console.error("Course creation error:", error);
      return next(
        new ErrorHandler(500, error.message || "Error creating course")
      );
    }
  }
);

// edit course

export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const data = req.body;

      // Find the existing course
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler(404, "Course not found"));
      }

      // Handle thumbnail update if provided
      if (data.thumbnail) {
        try {
          // Delete old thumbnail if it exists
          if (course.thumbnail && course.thumbnail.public_id) {
            await cloudinary.v2.uploader.destroy(course.thumbnail.public_id);
          }

          // Upload new thumbnail
          const myCloud = await cloudinary.v2.uploader.upload(data.thumbnail, {
            folder: "courses",
          });

          data.thumbnail = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } catch (error: any) {
          console.error("Cloudinary upload error:", error);
          return next(new ErrorHandler(500, "Error uploading thumbnail"));
        }
      }

      // Update the course
      const updatedCourse = await CourseModel.findByIdAndUpdate(
        courseId,
        {
          $set: data,
        },
        { new: true, runValidators: true }
      );

      if (!updatedCourse) {
        return next(new ErrorHandler(404, "Course not found"));
      }

      // Update Redis cache
      try {
        const coursesData = await redis.get("courses");
        if (coursesData) {
          const courses = JSON.parse(coursesData);
          const courseIndex = courses.findIndex(
            (c: any) => c._id.toString() === courseId
          );

          if (courseIndex !== -1) {
            courses[courseIndex] = updatedCourse.toJSON();
            await redis.set("courses", JSON.stringify(courses));
          }
        }
      } catch (error: any) {
        console.error("Redis cache update error:", error);
        // Don't return here as the course is already updated in DB
      }

      res.status(200).json({
        success: true,
        message: "Course updated successfully",
        course: updatedCourse,
      });
    } catch (error: any) {
      return next(
        new ErrorHandler(500, error.message || "Error updating course")
      );
    }
  }
);
