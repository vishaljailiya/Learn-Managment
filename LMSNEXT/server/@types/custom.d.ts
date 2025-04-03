import { IUser } from "../Models/User.model";
import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
