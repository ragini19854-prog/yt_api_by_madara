import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import path from "node:path";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.CLERK_PUBLISHABLE_KEY) {
  app.use(
    clerkMiddleware({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    }),
  );
} else {
  logger.warn(
    "CLERK_PUBLISHABLE_KEY is not configured; running API in guest mode",
  );
}

app.use("/api", router);

// Railway runs the API and the compiled Vite app in one service. Replit keeps
// its frontend as a separate static artifact, so this is opt-in.
const frontendDistDir = process.env.FRONTEND_DIST_DIR;
if (frontendDistDir) {
  const frontendRoot = path.resolve(frontendDistDir);
  app.use(express.static(frontendRoot, { index: "index.html" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(path.join(frontendRoot, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

export default app;
