import { Router, type IRouter } from "express";
import { requireAdmin } from "../../middlewares/admin";
import suppliersRouter from "./suppliers";
import importsRouter from "./imports";
import emailRouter from "./email";
import helpRouter from "./help";
import supportRouter from "./support";
import seedHelpRouter from "./seed-help";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(requireAdmin);
router.use(suppliersRouter);
router.use(importsRouter);
router.use(emailRouter);
router.use(helpRouter);
router.use(supportRouter);
router.use(seedHelpRouter);
router.use(settingsRouter);

export default router;
