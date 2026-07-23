import { demoDb, getExpectedProjectId } from '../src/lib/firebase-admin';

try {
  getExpectedProjectId();
  const db = demoDb();
  if (db) {
    console.log("INIT_SUCCESS");
  } else {
    console.log("INIT_NULL");
  }
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.log("INIT_ERROR: " + msg);
}
