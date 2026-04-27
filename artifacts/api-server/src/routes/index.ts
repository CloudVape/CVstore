import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import postsRouter from "./posts";
import commentsRouter from "./comments";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use(postsRouter);
router.use(commentsRouter);
router.use(statsRouter);

export default router;
