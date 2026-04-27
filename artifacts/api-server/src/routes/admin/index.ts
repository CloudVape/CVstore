import { Router, type IRouter } from "express";
import { requireAdmin } from "../../middlewares/admin";
import suppliersRouter from "./suppliers";
import importsRouter from "./imports";
import emailRouter from "./email";

const router: IRouter = Router();

router.use(requireAdmin);
router.use(suppliersRouter);
router.use(importsRouter);
router.use(emailRouter);

export default router;
