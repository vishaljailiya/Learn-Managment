import cloudinary from "cloudinary";

export const configureCloudinary = () => {
  try {
    cloudinary.v2.config({
      cloud_name: process.env.CLOUD_NAME,
      api_key: process.env.CLOUD_API_KEY,
      api_secret: process.env.CLOUD_SECRET_KEY,
    });
    console.log("✅ Cloudinary configured successfully");
  } catch (error: any) {
    console.error("❌ Cloudinary configuration error:", error);
    throw new Error("Cloudinary configuration failed");
  }
};
