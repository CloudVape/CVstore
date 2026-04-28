import path from "path";
import { Router } from "express";
import { requireAdmin } from "../middlewares/admin";

const router = Router();

const SAMPLE_FEEDS_DIR = path.resolve(__dirname, "sample-feeds");

const ALLOWED_FILES = new Set([
  "example-supplier.csv",
  "example-supplier.json",
  "example-supplier.xml",
  "example-shopify-export.json",
]);

router.get("/sample-feeds/:filename", requireAdmin, (req, res) => {
  const { filename } = req.params;

  if (!ALLOWED_FILES.has(filename)) {
    res.status(404).json({ error: "Sample file not found" });
    return;
  }

  const filePath = path.join(SAMPLE_FEEDS_DIR, filename);
  res.download(filePath, filename, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: "Failed to send file" });
    }
  });
});

export default router;
