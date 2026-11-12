import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, db, logAudit, computeSha256 } from './server/db.js';
import {
  getPayPalConfig,
  createPayPalOrder,
  capturePayPalOrder,
  handleIncomingWebhook,
  getPayPalOrder,
  testPayPalOAuth,
  reconcilePaymentWithPayPal,
} from './server/paypal.js';
import {
  evaluateAuthorization,
  validateAndConsumeAuthorizationToken,
  runProvisioningSimulation,
  verifyDelivery,
  runReconciliation,
  generateIncidentAnalysis,
  executeRecovery,
  rejectRecovery,
} from './server/engine.js';
import { runPresetScenario, seedDemoScenariosIfEmpty } from './server/scenarios.js';
import {
  runBackendVerification,
  runPayPalSandboxVerification,
  runProvisioningVerification,
  runReconciliationScenarios,
  runRecoveryVerification,
  runAiVerification,
  saveVerificationRun,
  getLatestVerificationRun,
} from './server/verification.js';

dotenv.config();

// Protect process from unhandled asynchronous rejections
process.on('uncaughtException', (err) => {
  console.error('[PAYPILOT] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[PAYPILOT] Unhandled rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// API Endpoints
// ==========================================

// 1. Health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'PAYPILOT — NEXUS MODE',
    timestamp: new Date().toISOString(),
    database: 'SQLite WAL mode ACTIVE',
  });
});

// 2. Agents
app.get('/api/agents', (_req: Request, res: Response) => {
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
  res.json(agents.map((a: any) => ({
    ...a,
    categories: JSON.parse(a.categories || '[]'),
    allowed_merchants: JSON.parse(a.allowed_merchants || '[]'),
  })));
});

app.post('/api/agents', (req: Request, res: Response) => {
  const { name, purpose, description, categories, max_amount, currency, allowed_merchants, auth_reference } = req.body;
  const id = `agt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  db.prepare(`
    INSERT INTO agents (id, name, purpose, description, status, categories, max_amount, currency, allowed_merchants, auth_reference, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name || 'Custom Agent',
    purpose || 'Autonomous purchasing subagent',
    description || 'Custom provisioned agent policy',
    JSON.stringify(categories || ['Cloud Services']),
    Number(max_amount) || 100.0,
    currency || 'USD',
    JSON.stringify(allowed_merchants || ['Nexus Compute']),
    auth_reference || `AUTH-POLICY-${Date.now()}`,
    now.toISOString(),
    expires.toISOString()
  );

  logAudit('AGENT_CREATED', 'OPERATOR', { id, name });
  res.status(201).json({ id, message: 'Agent registered successfully' });
});

app.patch('/api/agents/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, id);
  logAudit('AGENT_STATUS_UPDATED', 'OPERATOR', { id, status });
  res.json({ success: true, id, status });
});

// 3. Authorizations
app.get('/api/authorizations', (_req: Request, res: Response) => {
  const auths = db.prepare(`
    SELECT a.*, ag.name as agent_name 
    FROM authorizations a 
    JOIN agents ag ON a.agent_id = ag.id 
    ORDER BY a.created_at DESC
  `).all();
  res.json(auths);
});

app.post('/api/authorizations/evaluate', (req: Request, res: Response) => {
  try {
    const result = evaluateAuthorization(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Purchases & Transactions
app.get('/api/purchases', (_req: Request, res: Response) => {
  const purchases = db.prepare(`
    SELECT p.*, ag.name as agent_name,
      rec.status as reconciliation_status,
      rec.mismatch_category,
      pay.status as payment_status,
      pay.paypal_order_id,
      pay.capture_id,
      pay.mode as payment_mode,
      prov.status as provisioning_status,
      prov.service_id,
      verif.status as delivery_status,
      inc.id as incident_id,
      inc.status as incident_status,
      inc.severity as incident_severity
    FROM purchases p
    JOIN agents ag ON p.agent_id = ag.id
    LEFT JOIN (
      SELECT * FROM reconciliation_results WHERE id IN (
        SELECT MAX(id) FROM reconciliation_results GROUP BY purchase_id
      )
    ) rec ON p.id = rec.purchase_id
    LEFT JOIN paypal_payments pay ON p.id = pay.purchase_id
    LEFT JOIN (
      SELECT * FROM provisioning_operations WHERE id IN (
        SELECT MAX(id) FROM provisioning_operations GROUP BY purchase_id
      )
    ) prov ON p.id = prov.purchase_id
    LEFT JOIN (
      SELECT * FROM delivery_verifications WHERE id IN (
        SELECT MAX(id) FROM delivery_verifications GROUP BY purchase_id
      )
    ) verif ON p.id = verif.purchase_id
    LEFT JOIN incidents inc ON p.id = inc.purchase_id
    ORDER BY p.created_at DESC
  `).all();

  res.json(purchases);
});

app.get('/api/purchases/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const purchase = db.prepare(`
    SELECT p.*, ag.name as agent_name, ag.purpose as agent_purpose
    FROM purchases p
    JOIN agents ag ON p.agent_id = ag.id
    WHERE p.id = ?
  `).get(id);

  if (!purchase) {
    return res.status(404).json({ error: 'Purchase not found' });
  }

  const auth = (purchase as any).authorization_id
    ? db.prepare('SELECT * FROM authorizations WHERE id = ?').get((purchase as any).authorization_id)
    : null;
  const payment = db.prepare('SELECT * FROM paypal_payments WHERE purchase_id = ?').get(id);
  const webhooks = db.prepare('SELECT * FROM webhook_events WHERE purchase_id = ? ORDER BY received_at DESC').all(id);
  const provisioningOps = db.prepare('SELECT * FROM provisioning_operations WHERE purchase_id = ? ORDER BY attempt_number DESC').all(id);
  const verifications = db.prepare('SELECT * FROM delivery_verifications WHERE purchase_id = ? ORDER BY verified_at DESC').all(id);
  const reconciliations = db.prepare('SELECT * FROM reconciliation_results WHERE purchase_id = ? ORDER BY reconciled_at DESC').all(id);
  const incident = db.prepare('SELECT * FROM incidents WHERE purchase_id = ?').get(id);
  const recoveryProposals = db.prepare('SELECT * FROM recovery_proposals WHERE purchase_id = ? ORDER BY created_at DESC').all(id);
  const evidenceRecords = db.prepare('SELECT * FROM evidence_records WHERE purchase_id = ? ORDER BY recorded_at ASC').all(id);

  res.json({
    purchase,
    authorization: auth,
    payment,
    webhooks: webhooks.map((w: any) => ({ ...w, payload: JSON.parse(w.payload || '{}') })),
    provisioningOperations: provisioningOps.map((p: any) => ({ ...p, response_payload: JSON.parse(p.response_payload || '{}') })),
    verifications,
    reconciliations,
    incident,
    recoveryProposals,
    evidenceRecords: evidenceRecords.map((e: any) => ({ ...e, payload: JSON.parse(e.payload || '{}') })),
  });
});

app.post('/api/purchases', async (req: Request, res: Response) => {
  try {
    const { agentId, productName, serviceType, merchant, amount, currency, simulateOutcome, authorizationId } = req.body;
    const now = new Date().toISOString();
    const purchaseId = `PUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    let activeAuthId: string | null = null;

    // If caller provided an authorization token, strictly validate and consume it (Replay & Tamper Check)
    if (authorizationId) {
      const tokenCheck = validateAndConsumeAuthorizationToken(authorizationId, {
        agentId,
        productName,
        merchant,
        amount: Number(amount),
        currency: currency || 'USD',
      });

      if (!tokenCheck.valid) {
        db.prepare(`
          INSERT INTO purchases (id, agent_id, authorization_id, product_name, service_type, merchant, amount, currency, status, scenario_tag, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(purchaseId, agentId, authorizationId, productName, serviceType, merchant, Number(amount), currency || 'USD', 'BLOCKED', 'TOKEN_VIOLATION_BLOCKED', now, now);

        runReconciliation(purchaseId);
        return res.status(200).json({ purchaseId, status: 'BLOCKED', reason: tokenCheck.rejectionReason, code: tokenCheck.rejectionCode });
      }
      activeAuthId = authorizationId;
    } else {
      // 1. Dynamic Authorization Evaluation
      const authResult = evaluateAuthorization({
        agentId,
        productName,
        category: serviceType.includes('Storage') ? 'Storage' : serviceType.includes('Monitoring') ? 'Monitoring' : 'Cloud Services',
        merchant,
        amount: Number(amount),
        currency: currency || 'USD',
        purpose: `Autonomous purchase of ${productName}`,
      });

      if (!authResult.allowed) {
        db.prepare(`
          INSERT INTO purchases (id, agent_id, authorization_id, product_name, service_type, merchant, amount, currency, status, scenario_tag, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(purchaseId, agentId, null, productName, serviceType, merchant, Number(amount), currency || 'USD', 'BLOCKED', 'CUSTOM_AUTH_BLOCKED', now, now);

        runReconciliation(purchaseId);
        return res.status(200).json({ purchaseId, status: 'BLOCKED', reason: authResult.rejectionReason });
      }

      activeAuthId = authResult.authorizationId;
      // Mark token consumed for this transaction
      db.prepare("UPDATE authorizations SET status = 'USED' WHERE id = ?").run(activeAuthId);
    }

    // 2. Create Purchase Record
    db.prepare(`
      INSERT INTO purchases (id, agent_id, authorization_id, product_name, service_type, merchant, amount, currency, status, scenario_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(purchaseId, agentId, activeAuthId, productName, serviceType, merchant, Number(amount), currency || 'USD', 'PENDING', 'CUSTOM_RUN', now, now);

    // 3. PayPal Order & Capture
    const order = await createPayPalOrder({
      purchaseId,
      amount: Number(amount),
      currency: currency || 'USD',
      productName,
    });
    const capture = await capturePayPalOrder(order.orderId, purchaseId);

    const payId = `PAY-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO paypal_payments (id, purchase_id, paypal_order_id, capture_id, amount, currency, status, mode, raw_response, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payId,
      purchaseId,
      order.orderId,
      capture.captureId,
      Number(amount),
      currency || 'USD',
      capture.status,
      capture.mode,
      JSON.stringify(capture.raw),
      now,
      now
    );

    // 4. Provisioning simulation
    const outcome = simulateOutcome || 'SUCCESS';
    runProvisioningSimulation(purchaseId, serviceType, outcome, 1);

    // 5. Verification
    verifyDelivery(purchaseId);

    // 6. Reconciliation
    const recon = runReconciliation(purchaseId);

    // If incident created, kick off AI analysis
    const inc = db.prepare('SELECT id FROM incidents WHERE purchase_id = ?').get(purchaseId) as any;
    if (inc) {
      generateIncidentAnalysis(inc.id).catch((e) => console.error('Background AI analysis error:', e));
    }

    res.status(201).json({
      purchaseId,
      reconciliationStatus: recon.status,
      orderId: order.orderId,
      captureId: capture.captureId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. PayPal Endpoints
app.get('/api/paypal/config', (_req: Request, res: Response) => {
  const config = getPayPalConfig();
  res.json({
    mode: config.mode,
    isConfigured: config.isConfigured,
    clientIdPrefix: config.clientId ? config.clientId.substring(0, 8) + '...' : null,
  });
});

app.post('/api/paypal/webhooks', async (req: Request, res: Response) => {
  try {
    const headers = req.headers as Record<string, string | undefined>;
    const result = await handleIncomingWebhook(req.body, headers);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Incidents & AI Analysis
app.get('/api/incidents', (_req: Request, res: Response) => {
  const incidents = db.prepare(`
    SELECT inc.*, p.product_name, p.amount, p.currency, ag.name as agent_name,
      rec.status as reconciliation_status, rec.mismatch_category
    FROM incidents inc
    JOIN purchases p ON inc.purchase_id = p.id
    JOIN agents ag ON p.agent_id = ag.id
    JOIN reconciliation_results rec ON inc.reconciliation_id = rec.id
    ORDER BY inc.created_at DESC
  `).all();
  res.json(incidents);
});

app.post('/api/ai/analyze', async (req: Request, res: Response) => {
  try {
    const { incidentId } = req.body;
    const result = await generateIncidentAnalysis(incidentId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Recovery Center
app.get('/api/recovery/proposals', (_req: Request, res: Response) => {
  const proposals = db.prepare(`
    SELECT prop.*, inc.severity, inc.summary as incident_summary, p.product_name, p.amount, p.currency, ag.name as agent_name
    FROM recovery_proposals prop
    JOIN incidents inc ON prop.incident_id = inc.id
    JOIN purchases p ON prop.purchase_id = p.id
    JOIN agents ag ON p.agent_id = ag.id
    ORDER BY prop.created_at DESC
  `).all();
  res.json(proposals);
});

app.post('/api/recovery/execute', (req: Request, res: Response) => {
  try {
    const { proposalId, operator } = req.body;
    const result = executeRecovery(proposalId, operator || 'OP-NEXUS-01');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/recovery/reject', (req: Request, res: Response) => {
  try {
    const { proposalId, operator, reason } = req.body;
    const result = rejectRecovery(proposalId, operator || 'OP-NEXUS-01', reason);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Evidence Vault & Chain Verification
app.get('/api/evidence/verify-chain/:purchaseId', (req: Request, res: Response) => {
  const { purchaseId } = req.params;
  const records = db.prepare('SELECT * FROM evidence_records WHERE purchase_id = ? ORDER BY recorded_at ASC, id ASC').all(purchaseId) as any[];

  let isValid = true;
  let brokenIndex = -1;
  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.prev_hash !== previousHash) {
      isValid = false;
      brokenIndex = i;
      break;
    }

    const hashInput = `${rec.id}|${rec.purchase_id}|${rec.event_type}|${rec.source_entity}|${rec.payload}|${rec.prev_hash}|${rec.recorded_at}`;
    const calculatedHash = computeSha256(hashInput);

    if (calculatedHash !== rec.current_hash) {
      isValid = false;
      brokenIndex = i;
      break;
    }

    previousHash = rec.current_hash;
  }

  res.json({
    purchaseId,
    totalRecords: records.length,
    isChainValid: isValid,
    brokenRecordIndex: brokenIndex,
    verifiedAt: new Date().toISOString(),
    disclaimer: 'A cryptographic SHA-256 hash proves that recorded evidence has not changed since hashing. It does not independently prove that the underlying event was truthful.',
    records: records.map((r) => ({ ...r, payload: JSON.parse(r.payload || '{}') })),
  });
});

app.get('/api/evidence/export-markdown/:purchaseId', (req: Request, res: Response) => {
  const { purchaseId } = req.params;
  const purchase = db.prepare('SELECT p.*, ag.name as agent_name FROM purchases p JOIN agents ag ON p.agent_id = ag.id WHERE p.id = ?').get(purchaseId) as any;
  if (!purchase) {
    return res.status(404).send('# Error: Transaction not found');
  }

  const records = db.prepare('SELECT * FROM evidence_records WHERE purchase_id = ? ORDER BY recorded_at ASC, id ASC').all(purchaseId) as any[];
  const recon = db.prepare('SELECT * FROM reconciliation_results WHERE purchase_id = ? ORDER BY reconciled_at DESC LIMIT 1').get(purchaseId) as any;

  let isValid = true;
  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.prev_hash !== previousHash || computeSha256(`${r.id}|${r.purchase_id}|${r.event_type}|${r.source_entity}|${r.payload}|${r.prev_hash}|${r.recorded_at}`) !== r.current_hash) {
      isValid = false;
      break;
    }
    previousHash = r.current_hash;
  }

  const md = `# PAYPILOT FORENSIC INCIDENT & EVIDENCE REPORT
**Transaction ID**: ${purchase.id}
**Agent**: ${purchase.agent_name} (\`${purchase.agent_id}\`)
**Product / Service**: ${purchase.product_name} (${purchase.service_type})
**Merchant**: ${purchase.merchant}
**Amount**: $${Number(purchase.amount).toFixed(2)} ${purchase.currency}
**Reconciliation Status**: ${recon?.status || purchase.status}
**Generated At**: ${new Date().toISOString()}

---

## 1. Cryptographic Hash Chain Audit
- **Chain Integrity Status**: ${isValid ? 'VERIFIED_INTACT (SHA-256)' : 'CORRUPTED / TAMPER DETECTED'}
- **Total Evidence Records**: ${records.length}
- **Hash Standard**: SHA-256 with Canonical JSON Serialization

> **Cryptographic Invariant Notice**:
> A cryptographic SHA-256 hash proves that recorded evidence has not changed since hashing. It does not independently prove that the underlying event was truthful.

---

## 2. Chronological Evidence Records
${records.map((r, i) => `### Record ${i + 1}: ${r.event_type}
- **ID**: \`${r.id}\`
- **Source**: \`${r.source_entity}\`
- **Timestamp**: ${r.recorded_at}
- **Previous Hash**: \`${r.prev_hash}\`
- **Current Hash**: \`${r.current_hash}\`

\`\`\`json
${JSON.stringify(JSON.parse(r.payload || '{}'), null, 2)}
\`\`\`
`).join('\n')}

---
*Report generated by PAYPILOT Nexus Mode — Autonomous Commerce Intelligence Platform.*
`;

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="paypilot-evidence-${purchaseId}.md"`);
  res.send(md);
});

// 9. Integrations Status
app.get('/api/integrations', (_req: Request, res: Response) => {
  const paypalConfig = getPayPalConfig();
  const apiKey = process.env.GEMINI_API_KEY;
  const hasGemini = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

  const purchaseCount = (db.prepare('SELECT COUNT(*) as count FROM purchases').get() as any).count;
  const incidentCount = (db.prepare('SELECT COUNT(*) as count FROM incidents').get() as any).count;

  res.json({
    paypal: {
      name: 'PayPal Sandbox Orders & Webhooks',
      status: paypalConfig.isConfigured ? 'CONNECTED' : 'DEMO_MODE',
      mode: paypalConfig.mode,
      details: paypalConfig.isConfigured ? 'Live Sandbox Client & Webhook Verifier active' : 'Simulated high-fidelity PayPal gateway active',
    },
    gemini: {
      name: 'Google Gemini AI (gemini-3.8-flash)',
      status: hasGemini ? 'CONNECTED' : 'DEMO_MODE',
      details: hasGemini ? 'Server-side forensic investigation agent enabled' : 'Deterministic forensic reasoning engine active (fallback)',
    },
    sqlite: {
      name: 'SQLite Database & Evidence Ledger',
      status: 'CONNECTED',
      details: `WAL mode active. ${purchaseCount} transactions, ${incidentCount} incidents recorded.`,
    },
    simulator: {
      name: 'Digital Service Provisioning Simulator',
      status: 'CONNECTED',
      details: 'Active simulators: Cloud Monitoring, NVMe Storage, Compute Slices, SaaS Licenses',
    },
  });
});

// 10. Demo Scenario Runner & Reset
app.post('/api/demo/run-scenario', async (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const result = await runPresetScenario(Number(scenario) as 1 | 2 | 3 | 4);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/demo/reset', (_req: Request, res: Response) => {
  try {
    db.exec(`
      DELETE FROM evidence_records;
      DELETE FROM recovery_proposals;
      DELETE FROM incidents;
      DELETE FROM reconciliation_results;
      DELETE FROM delivery_verifications;
      DELETE FROM provisioning_operations;
      DELETE FROM webhook_events;
      DELETE FROM paypal_payments;
      DELETE FROM purchases;
      DELETE FROM authorizations;
    `);

    // Re-seed scenarios
    runPresetScenario(1);
    runPresetScenario(2);
    runPresetScenario(3);
    runPresetScenario(4);

    logAudit('DATABASE_RESET', 'OPERATOR', { message: 'Reset all transactions and re-seeded demo scenarios 1-4' });
    res.json({ success: true, message: 'Database reset to clean hackathon demo state' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. System Verification Center Endpoints
// ==========================================
app.get('/api/verification/history', (_req: Request, res: Response) => {
  try {
    const latest = getLatestVerificationRun();
    res.json(latest || { totalTests: 0, passedTests: 0, failedTests: 0, waitingTests: 0, notConfiguredTests: 0, tests: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verification/run-all', async (_req: Request, res: Response) => {
  try {
    const backend = await runBackendVerification();
    const paypal = await runPayPalSandboxVerification();
    const prov = await runProvisioningVerification();
    const recon = await runReconciliationScenarios();
    const recov = await runRecoveryVerification();
    const ai = await runAiVerification();

    const all = [...backend, ...paypal, ...prov, ...recon, ...recov, ...ai];
    const summary = saveVerificationRun('ALL', all);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verification/run-group', async (req: Request, res: Response) => {
  try {
    const { groupName } = req.body;
    let tests: any[] = [];
    if (groupName === 'BACKEND') tests = await runBackendVerification();
    else if (groupName === 'PAYPAL_SANDBOX') tests = await runPayPalSandboxVerification();
    else if (groupName === 'PROVISIONING') tests = await runProvisioningVerification();
    else if (groupName === 'RECONCILIATION') tests = await runReconciliationScenarios();
    else if (groupName === 'RECOVERY') tests = await runRecoveryVerification();
    else if (groupName === 'AI_INTELLIGENCE') tests = await runAiVerification();
    else return res.status(400).json({ error: `Unknown verification group: ${groupName}` });

    const summary = saveVerificationRun(groupName, tests);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verification/paypal/create-approval-order', async (req: Request, res: Response) => {
  try {
    const testPurId = `PUR-PAYPAL-INTERACTIVE-${Date.now().toString(36).toUpperCase()}`;
    const amount = Number(req.body.amount) || 15.0;
    const orderRes = await createPayPalOrder({
      purchaseId: testPurId,
      amount,
      currency: 'USD',
      productName: 'PayPal Interactive Sandbox Verification Token',
    });

    res.json({
      purchaseId: testPurId,
      orderId: orderRes.orderId,
      approvalUrl: orderRes.approvalUrl,
      mode: orderRes.mode,
      status: orderRes.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/verification/paypal/check-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await getPayPalOrder(orderId);
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verification/paypal/capture-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { purchaseId } = req.body;
    const capture = await capturePayPalOrder(orderId, purchaseId || 'PUR-VERIF-CAPTURE');
    res.json(capture);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Server lifecycle and bootstrap
async function startServer() {
  try {
    initDatabase();
    await seedDemoScenariosIfEmpty();
  } catch (err) {
    console.warn('[PAYPILOT] Initial database bootstrap warning:', err);
  }

  const isProd = process.env.NODE_ENV === 'production';
  const args = process.argv.slice(2);
  let port = 3000;
  let host = '0.0.0.0';

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
      port = parseInt(args[i + 1], 10) || 3000;
    }
    if ((args[i] === '--host' || args[i] === '-H') && args[i + 1]) {
      host = args[i + 1];
    }
  }
  if (process.env.PORT) {
    port = parseInt(process.env.PORT, 10) || port;
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(port, host, () => {
    console.log(`PAYPILOT Nexus server running at http://${host}:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is in use. Exiting to allow supervisor restart.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

startServer();
