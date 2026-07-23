import { spawnSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

console.log("==================================================");
console.log("  Volimox Firebase Isolation Guardrail Test Suite ");
console.log("==================================================\n");

// Load base valid service account key from .env.local without logging it
let baseSaRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
if (!baseSaRaw) {
  const envPath = path.join(rootDir, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
        baseSaRaw = trimmed.slice('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim();
        if ((baseSaRaw.startsWith('"') && baseSaRaw.endsWith('"')) || (baseSaRaw.startsWith("'") && baseSaRaw.endsWith("'"))) {
          baseSaRaw = baseSaRaw.slice(1, -1);
        }
        break;
      }
    }
  }
}

if (!baseSaRaw) {
  console.error("FAIL: Could not load base FIREBASE_SERVICE_ACCOUNT_KEY from environment or .env.local");
  process.exit(1);
}

let parsedBase = null;
try {
  const s = baseSaRaw.startsWith('{') ? baseSaRaw : Buffer.from(baseSaRaw, 'base64').toString('utf8');
  parsedBase = JSON.parse(s);
} catch {
  console.error("FAIL: Could not parse base FIREBASE_SERVICE_ACCOUNT_KEY");
  process.exit(1);
}

function createModifiedSa(overrideObj) {
  return JSON.stringify({ ...parsedBase, ...overrideObj });
}

function runTestCase(name, envVars, expectedOutcome) {
  console.log(`Testing Case: ${name}...`);

  const res = spawnSync('npx', ['tsx', 'scripts/_run_isolation_case.ts'], {
    cwd: rootDir,
    env: { ...process.env, ...envVars },
    encoding: 'utf8',
    shell: true,
  });

  const output = (res.stdout || "") + (res.stderr || "");

  // Ensure no credentials, private keys, or emails are leaked in output
  if (output.includes('BEGIN PRIVATE KEY') || output.includes('private_key')) {
    console.error("  [FAIL] Test output contained credential leak!");
    process.exit(1);
  }

  if (expectedOutcome.shouldFail) {
    if (output.includes('INIT_ERROR:') && output.includes(expectedOutcome.errorSubstr)) {
      console.log(`  [PASS] Correctly rejected with expected error: "${expectedOutcome.errorSubstr}"\n`);
      return true;
    } else {
      console.error(`  [FAIL] Expected error substring "${expectedOutcome.errorSubstr}", but got output:\n${output}\n`);
      process.exit(1);
    }
  } else {
    if (output.includes('INIT_SUCCESS')) {
      console.log(`  [PASS] Successfully validated volimox-platform credential.\n`);
      return true;
    } else {
      console.error(`  [FAIL] Expected successful initialization, but got output:\n${output}\n`);
      process.exit(1);
    }
  }
}

// Case 1: Valid volimox-platform credential passes
runTestCase("1. Valid volimox-platform credential", {
  FIREBASE_SERVICE_ACCOUNT_KEY: createModifiedSa({ project_id: "volimox-platform" }),
  VOLIMOX_FIREBASE_PROJECT_ID: "volimox-platform"
}, { shouldFail: false });

// Case 2: Proton credential rejected EVEN WHEN env variable redefines VOLIMOX_FIREBASE_PROJECT_ID=volimox-crm-dispatcher
runTestCase("2. Proton (volimox-crm-dispatcher) credential rejected even with env override", {
  FIREBASE_SERVICE_ACCOUNT_KEY: createModifiedSa({ project_id: "volimox-crm-dispatcher" }),
  VOLIMOX_FIREBASE_PROJECT_ID: "volimox-crm-dispatcher"
}, { shouldFail: true, errorSubstr: 'VOLIMOX_FIREBASE_PROJECT_ID "volimox-crm-dispatcher" is invalid' });

// Case 2b: Proton credential rejected when env variable is volimox-platform
runTestCase("2b. Proton credential rejected when env is volimox-platform", {
  FIREBASE_SERVICE_ACCOUNT_KEY: createModifiedSa({ project_id: "volimox-crm-dispatcher" }),
  VOLIMOX_FIREBASE_PROJECT_ID: "volimox-platform"
}, { shouldFail: true, errorSubstr: 'volimox-crm-dispatcher' });

// Case 3: Other project ID credential rejected
runTestCase("3. Random non-Volimox project credential rejected", {
  FIREBASE_SERVICE_ACCOUNT_KEY: createModifiedSa({ project_id: "some-other-project" }),
  VOLIMOX_FIREBASE_PROJECT_ID: "volimox-platform"
}, { shouldFail: true, errorSubstr: 'does not match expected Volimox project ID' });

// Case 4: Credential without project_id rejected
const missingPidSa = createModifiedSa({ project_id: undefined });
runTestCase("4. Service account missing project_id rejected", {
  FIREBASE_SERVICE_ACCOUNT_KEY: missingPidSa,
  VOLIMOX_FIREBASE_PROJECT_ID: "volimox-platform"
}, { shouldFail: true, errorSubstr: 'missing a valid project_id' });

// Case 5: Malformed JSON rejected
runTestCase("5. Malformed service account JSON rejected", {
  FIREBASE_SERVICE_ACCOUNT_KEY: "{ malformed_json: ",
  VOLIMOX_FIREBASE_PROJECT_ID: "volimox-platform"
}, { shouldFail: true, errorSubstr: 'invalid or missing required credentials' });

console.log("All 6 isolation test cases PASSED successfully!");
