import app from "./app";
import { logger } from "./lib/logger";
import { startHardwareReviewJob } from "./jobs/hardware-reviews";
import { startReviewEmailJob } from "./jobs/review-emails";
import { startSupplierSyncJob } from "./jobs/supplier-sync";
import { startProductSpotlightJob } from "./jobs/product-spotlight";
import { startBackInStockJob } from "./jobs/back-in-stock";
import { startWeeklyDigestJob } from "./jobs/weekly-digest";
import { startWinBackJob } from "./jobs/win-back";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startHardwareReviewJob();
  startReviewEmailJob();
  startSupplierSyncJob();
  startProductSpotlightJob();
  startBackInStockJob();
  startWeeklyDigestJob();
  startWinBackJob();
});
