import { log } from "console";
import { app } from "./app";
import connectDB from "./utils/db";
import dotenv from "dotenv";
dotenv.config();

console.log("ACCESS_TOKEN:", process.env.ACCESS_TOKEN); // Debug log

// create server

app.listen(process.env.PORT, () => {
  console.log(`serevr is start to post ${process.env.PORT}`);
  connectDB();
});
