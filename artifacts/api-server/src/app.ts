import express, { type Express, type Request } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const ALLOWED_ORIGINS = [
  "https://cloudvape.store",
  "https://www.cloudvape.store",
  "https://app.cloudvape.store",
];

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

declare module "express" {
  interface Request {
    rawBody?: Buffer;
  }
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(helmet());
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const isDev = process.env.NODE_ENV !== "production";
app.use(cors({
  credentials: true,
  origin: isDev ? true : (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error("Not allowed by CORS"));
  },
}));
app.use("/api", apiLimiter);
app.use(
  express.json({
    limit: "10mb",
    verify: (req: Request, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
