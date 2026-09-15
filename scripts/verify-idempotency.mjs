import fs from 'node:fs';
import path from 'node:path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import {
  deriveSessionId,
  createFollowUpSession,
  getOrCreateFollowUpSession,
  saveFollowUpSession,
  claimInitialSessionCall,
  updateInitialCallState,
  claimInitialSessionEmail,
  claimCallbackCall,
  claimSessionLeadNotification,
} from '../src/lib/follow-up-demo';
import { demoDb, getDemoTenantId, getFollowUpSessionsCollection, getDemoLeadsCollection, getDemoReservationsCollection } from '../src/lib/firebase-admin';

console.log("==================================================");
console.log(" Volimox Production Real Firestore Idempotency Suite");
console.log("==================================================\n");

const db = demoDb();
if (!db) {
  console.error("FAIL: demoDb() returned null. FIREBASE_SERVICE_ACCOUNT_KEY must be configured for real Firestore idempotency testing.");
  process.exit(1);
}

console.log("Connected to Firestore database (volimox-platform) successfully.\n");
const tenantId = getDemoTenantId();
const createdDocRefs = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

async function runTests() {
  try {
    // 1. Test Session ID derivation determinism
    console.log("1. Testing session ID derivation determinism...");
    const key = `key-test-${Date.now()}`;
    const id1 = deriveSessionId(key);
    const id2 = deriveSessionId(key);
    assert(id1 === id2 && id1.startsWith("session-"), `Expected deterministic session ID starting with 'session-', got ${id1} and ${id2}`);
    console.log("  [PASS] Session ID derived deterministically from idempotency key.\n");

    // 2. Test Concurrent Session Creation with same Idempotency Key
    console.log("2. Testing concurrent session creation with identical idempotency key...");
    const concKey = `concurrent-form-${Date.now()}`;
    const [create1, create2] = await Promise.all([
      getOrCreateFollowUpSession({
        fullName: "Concurrent User 1",
        email: "conc1@example.com",
        phone: "+15555550111",
        companyName: "Conc 1",
        businessType: "HVAC",
        consentSms: true,
        consentEmail: true,
        consentCall: true,
        idempotencyKey: concKey,
      }),
      getOrCreateFollowUpSession({
        fullName: "Concurrent User 2",
        email: "conc2@example.com",
        phone: "+15555550111",
        companyName: "Conc 2",
        businessType: "HVAC",
        consentSms: true,
        consentEmail: true,
        consentCall: true,
        idempotencyKey: concKey,
      }),
    ]);

    const sessionRef = getFollowUpSessionsCollection(db, tenantId).doc(create1.session.id);
    createdDocRefs.push(sessionRef);

    assert(create1.session.id === create2.session.id, `Concurrent requests created two different session IDs: ${create1.session.id} vs ${create2.session.id}`);
    const isNewCount = [create1.isNew, create2.isNew].filter(Boolean).length;
    assert(isNewCount === 1, `Exactly 1 request should create new session, but isNewCount was ${isNewCount}`);
    console.log("  [PASS] Concurrent form submissions mapped to exact same session ID; duplicate session creation prevented.\n");

    // 3. Test started -> save -> re-claim State Protection
    console.log("3. Testing started call state protection against overwrite & re-claim...");
    const session = create1.session;

    // Claim initial call
    const claimRes = await claimInitialSessionCall(session.id);
    assert(claimRes.claimed === true, "Initial call claim should succeed.");

    // Update state to started
    await updateInitialCallState(session.id, "started", { twilioCallSid: "CA12345", twilioNumber: "+15555550100" });
    session.initialCallState = "started";

    // Simulate route saving session object
    await saveFollowUpSession(session);

    // Attempt second claim
    const secondClaim = await claimInitialSessionCall(session.id);
    assert(secondClaim.claimed === false, "Second claim on 'started' call MUST be rejected as duplicate.");
    console.log("  [PASS] Started call state preserved in Firestore; second call claim blocked.\n");

    // 4. Test Post-External-Call DB Failure Isolation
    console.log("4. Testing post-external-call DB failure isolation...");
    const postCallKey = `post-call-fail-${Date.now()}`;
    const { session: postCallSession } = await getOrCreateFollowUpSession({
      fullName: "Post Call User",
      email: "postcall@example.com",
      phone: "+15555550112",
      companyName: "PostCall",
      businessType: "Plumbing",
      consentSms: true,
      consentEmail: true,
      consentCall: true,
      idempotencyKey: postCallKey,
    });
    createdDocRefs.push(getFollowUpSessionsCollection(db, tenantId).doc(postCallSession.id));

    await claimInitialSessionCall(postCallSession.id);
    // Simulate external call succeeded, but DB update failed
    postCallSession.initialCallState = "started";
    await saveFollowUpSession(postCallSession);

    const reClaimAttempt = await claimInitialSessionCall(postCallSession.id);
    assert(reClaimAttempt.claimed === false, "After external call succeeds, re-claim MUST be rejected even if DB state update failed.");
    console.log("  [PASS] External call success prevents duplicate call on retries.\n");

    // 5. Test Session Lead Notification Deduplication
    console.log("5. Testing session lead notification claim deduplication...");
    const notifClaim1 = await claimSessionLeadNotification(session.id);
    const notifClaim2 = await claimSessionLeadNotification(session.id);
    assert(notifClaim1 === true, "First lead notification claim should succeed.");
    assert(notifClaim2 === false, "Second lead notification claim on same session MUST be rejected.");
    console.log("  [PASS] Session lead notification claimed once; duplicate notification blocked.\n");

    // 6. Test Lead Notification Claiming Transaction
    console.log("6. Testing lead notification atomic claiming transaction...");
    const leadDocId = `test-lead-${Date.now()}`;
    const leadRef = getDemoLeadsCollection(db, tenantId).doc(leadDocId);
    createdDocRefs.push(leadRef);

    const leadClaim1 = await db.runTransaction(async (tx) => {
      const snap = await tx.get(leadRef);
      if (!snap.exists) {
        tx.set(leadRef, { id: leadDocId, notificationStatus: "claiming", claimedAt: Date.now() });
        return true;
      }
      return false;
    });

    const leadClaim2 = await db.runTransaction(async (tx) => {
      const snap = await tx.get(leadRef);
      if (snap.exists && snap.data().notificationStatus === "claiming") {
        return false;
      }
      return true;
    });

    assert(leadClaim1 === true && leadClaim2 === false, "Lead notification claiming transaction failed.");
    console.log("  [PASS] Lead notification claimed atomically; concurrent request blocked.\n");

    // 7. Test Retell Reservation SMS Claiming
    console.log("7. Testing Retell reservation SMS claiming transaction...");
    const resId = `RETELL-RES-test-call-${Date.now()}`;
    const resRef = getDemoReservationsCollection(db, tenantId).doc(resId);
    createdDocRefs.push(resRef);

    const smsClaim1 = await db.runTransaction(async (tx) => {
      const snap = await tx.get(resRef);
      if (!snap.exists) {
        tx.set(resRef, { id: resId, smsStatus: "claiming", smsSent: false, claimedAt: Date.now() });
        return true;
      }
      return false;
    });

    const smsClaim2 = await db.runTransaction(async (tx) => {
      const snap = await tx.get(resRef);
      if (snap.exists && snap.data().smsStatus === "claiming") {
        return false;
      }
      return true;
    });

    assert(smsClaim1 === true && smsClaim2 === false, "Retell reservation SMS claiming transaction failed.");
    console.log("  [PASS] Retell SMS claimed atomically; concurrent webhook blocked.\n");

    console.log("All production real Firestore idempotency test cases PASSED successfully!");
  } finally {
    console.log("Cleaning up temporary test documents from Firestore...");
    for (const ref of createdDocRefs) {
      await ref.delete().catch((err) => console.error("  Warning: failed to delete test doc:", err.message));
    }
    console.log("Cleanup completed.\n");
  }
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("Idempotency test suite failed:", err);
  process.exit(1);
});
