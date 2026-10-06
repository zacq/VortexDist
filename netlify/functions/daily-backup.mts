import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { snapshot } from "../../server/backup";
import { getDb } from "../../server/db";

// Quality bar: daily backup. Snapshots are kept in the "backups" blob store; the Owner
// downloads them from Settings. 21:00 UTC = midnight Nairobi.
export default async () => {
  const db = await getDb();
  const data = await snapshot(db);
  const key = `vortex-${data.createdAt.slice(0, 10)}.json`;
  await getStore("backups").setJSON(key, data);
  console.log(`Backup written: ${key}`);
};

export const config: Config = {
  schedule: "0 21 * * *",
};
