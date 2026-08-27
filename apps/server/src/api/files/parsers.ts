import express from "express";

export const coverCropUploadParser = express.json({ limit: "12mb" });
