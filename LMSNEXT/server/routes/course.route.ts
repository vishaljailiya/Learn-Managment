import express from "express";
import { authorizeRoles, isAuthenticated } from "../Middleware/Auth";
import { createCourse, editCourse } from "../controller/course.controller";

const courseRouter = express.Router();

courseRouter.post(
  "/create-course",
  isAuthenticated,
  authorizeRoles("admin"),
  createCourse
);
courseRouter.put(
  "/edit-course/:id",
  isAuthenticated,
  authorizeRoles("admin"),
  editCourse
);

export default courseRouter;
