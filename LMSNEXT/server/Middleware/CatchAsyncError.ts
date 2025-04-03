import { NextFunction, Request, Response } from "express";

export const CatchAsyncError =
  (thefunc: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(thefunc(req, res, next)).catch(next);
  };
