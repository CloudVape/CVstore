import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import postsRouter from "./posts";
import commentsRouter from "./comments";
import statsRouter from "./stats";
import productCategoriesRouter from "./product-categories";
import productsRouter from "./products";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use(postsRouter);
router.use(commentsRouter);
router.use(statsRouter);
router.use(productCategoriesRouter);
router.use(productsRouter);
router.use(ordersRouter);

export default router;
