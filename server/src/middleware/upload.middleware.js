const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Files are stored on local disk under server/uploads/chat and served
// statically at /uploads/chat/<filename> (see index.js). Good enough for a
// single-server internal tool — swap the storage engine for S3/etc later
// without touching the controllers, since they only deal with the returned URL.
const uploadDir = path.join(__dirname, "..", "..", "uploads", "chat");
fs.mkdirSync(uploadDir, { recursive: true });

const avatarDir = path.join(__dirname, "..", "..", "uploads", "avatars");
fs.mkdirSync(avatarDir, { recursive: true });

const taskFileDir = path.join(__dirname, "..", "..", "uploads", "tasks");
fs.mkdirSync(taskFileDir, { recursive: true });

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, safeName);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, safeName);
  },
});

const taskFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, taskFileDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, safeName);
  },
});

// Block obviously dangerous file types from being uploaded/served.
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".msi", ".dll", ".com", ".scr"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new Error("This file type is not allowed"));
  }
  cb(null, true);
}

function avatarFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) {
    return cb(new Error("Avatar must be an image (jpg, png, gif, webp)"));
  }
  cb(null, true);
}

const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: MAX_AVATAR_SIZE }, fileFilter: avatarFilter });
const uploadTaskFile = multer({ storage: taskFileStorage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });

module.exports = { upload, uploadAvatar, uploadTaskFile, uploadDir, avatarDir, taskFileDir };
