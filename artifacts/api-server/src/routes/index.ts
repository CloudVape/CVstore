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
import seoRouter from "./seo";
import newsletterRouter from "./newsletter";
import emailWebhooksRouter from "./email-webhooks";
import adminRouter from "./admin";

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
router.use(seoRouter);
router.use(newsletterRouter);
router.use(emailWebhooksRouter);
router.use(adminRouter);

export default router;
