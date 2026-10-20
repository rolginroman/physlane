import { startDevServer, type DevServer } from "./harness";

let server: DevServer | undefined;

export async function setup(): Promise<void> {
  server = await startDevServer();
}

export async function teardown(): Promise<void> {
  await server?.stop();
}
