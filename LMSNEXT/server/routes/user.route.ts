import express from "express";
import {
  activateUser,
  authorizeRoles,
  getUserInfo,
  loginUser,
  logoutUser,
  registerationUser,
  socialAuth,
  updateAccessToken,
  updatePassword,
  updateUserInfo,
} from "../controller/user.controller";
import { isAuthenticated } from "../Middleware/Auth";

const userRouter = express.Router();

userRouter.post("/register", registerationUser);
userRouter.post("/activate-user", activateUser);
userRouter.post("/login", loginUser);
userRouter.get("/logout", isAuthenticated, logoutUser);

userRouter.get("/refresh", updateAccessToken);
userRouter.get("/me", isAuthenticated, getUserInfo);
userRouter.post("/social-auth", socialAuth);
userRouter.put("/update-user-info", isAuthenticated, updateUserInfo);
userRouter.put("/update-user-password", isAuthenticated, updatePassword);

export default userRouter;
