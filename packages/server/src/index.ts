import { buildApp, prepareDatabase } from "./app.js";
import { config } from "./config.js";
import { closeDriver } from "./db/driver.js";

async function main(): Promise<void> {
  const app = await buildApp();
  await prepareDatabase(app);

  await app.listen({ port: config.port, host: "0.0.0.0" });

  const shutdown = async (): Promise<void> => {
    await app.close();
    await closeDriver();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
