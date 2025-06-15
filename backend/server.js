const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});

const upload = multer({ storage });

/**
 * ✅ POST: Upload a new file
 */
app.post("/upload", upload.single("file"), (req, res) => {
  res
    .status(200)
    .json({ message: "File uploaded successfully", file: req.file });
});

/**
 * 🔁 PUT: Replace an existing file
 */
app.put("/update/:filename", upload.single("file"), (req, res) => {
  const oldFile = path.join(uploadDir, req.params.filename);

  if (!fs.existsSync(oldFile)) {
    return res.status(404).json({ error: "Original file not found" });
  }

  fs.unlinkSync(oldFile); // Delete old file

  const newFile = path.join(uploadDir, req.file.originalname);

  fs.renameSync(req.file.path, newFile);

  res.status(200).json({
    message: "File updated successfully",
    newFile: req.file.originalname,
  });
});

/**
 * ❌ DELETE: Remove a file
 */
app.delete("/delete/:filename", (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  fs.unlinkSync(filePath);
  res.status(200).json({ message: "File deleted successfully" });
});

app.post("/api/ocr", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    (async () => {
      try {
        let result;
        if ([".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"].includes(ext)) {
          result = await processImage(filePath);
        } else if (ext === ".pdf") {
          result = await processPDF(filePath);
        } else {
          return res.status(400).json({ error: "Unsupported file type" });
        }
        res.json(result);
      } catch (err) {
        console.error("Processing error:", err);
        res.status(500).json({ error: err.message });
      } finally {
        deleteFile(filePath);
      }
    })();
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
