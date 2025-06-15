const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "uploads");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Check if uploads directory exists, and create if it doesn't
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Save with original filename (optionally, handle conflicts here)
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

module.exports = upload;
