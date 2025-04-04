import { log } from "console";
import { app } from "./app";
import { v2 as cloudinary } from "cloudinary";
import connectDB from "./utils/db";
import dotenv from "dotenv";
dotenv.config();

console.log("ACCESS_TOKEN:", process.env.ACCESS_TOKEN); // Debug log
// cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET_KEY,
});

// create server

app.listen(process.env.PORT, () => {
  console.log(`serevr is start to post ${process.env.PORT}`);
  connectDB();
});
