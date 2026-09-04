import app from "./app";
import { logger } from "./lib/logger";
import { ensureSchema } from "./lib/dbBootstrap";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Fire-and-forget: ensureSchema() never throws, and the server should
// start listening (and serving the frontend / healthcheck) regardless of
// whether the DB is reachable yet.
void ensureSchema();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
