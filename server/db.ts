import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.resolve(process.cwd(), 'paypilot.sqlite');
export const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high reliability
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      categories TEXT NOT NULL, -- JSON array of strings
      max_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      allowed_merchants TEXT NOT NULL, -- JSON array of strings
      auth_reference TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authorizations (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      intended_product TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category TEXT NOT NULL,
      max_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      purpose TEXT NOT NULL,
      status TEXT NOT NULL, -- 'ACTIVE', 'USED', 'EXPIRED', 'BLOCKED'
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      hash TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents (id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      authorization_id TEXT,
      product_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      merchant TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL, -- 'PENDING', 'APPROVED', 'PAID', 'PROVISIONING', 'DELIVERED', 'FAILED', 'RECOVERED'
      scenario_tag TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents (id),
      FOREIGN KEY (authorization_id) REFERENCES authorizations (id)
    );

    CREATE TABLE IF NOT EXISTS paypal_payments (
      id TEXT PRIMARY KEY, -- Internal reference or payment ID
      purchase_id TEXT NOT NULL UNIQUE,
      paypal_order_id TEXT NOT NULL,
      capture_id TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL, -- 'CREATED', 'APPROVED', 'COMPLETED', 'PENDING', 'DECLINED', 'FAILED', 'UNKNOWN'
      mode TEXT NOT NULL DEFAULT 'DEMO', -- 'LIVE_SANDBOX' or 'DEMO'
      raw_response TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY, -- PayPal Webhook Event ID
      purchase_id TEXT,
      event_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      signature_status TEXT NOT NULL, -- 'VERIFIED', 'FAILED', 'SIMULATED_VERIFIED'
      payload TEXT NOT NULL,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      received_at TEXT NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    );

    CREATE TABLE IF NOT EXISTS provisioning_operations (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL, -- 'NOT_STARTED', 'REQUESTED', 'PROVISIONING', 'ACTIVE', 'FAILED', 'TIMEOUT', 'UNKNOWN', 'TERMINATED'
      response_payload TEXT,
      error_message TEXT,
      endpoint_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    );

    CREATE TABLE IF NOT EXISTS delivery_verifications (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      provisioning_id TEXT NOT NULL,
      status TEXT NOT NULL, -- 'VERIFIED', 'FAILED', 'UNKNOWN'
      probe_endpoint TEXT NOT NULL,
      http_status INTEGER,
      latency_ms INTEGER,
      verification_details TEXT,
      verified_at TEXT NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases (id),
      FOREIGN KEY (provisioning_id) REFERENCES provisioning_operations (id)
    );

    CREATE TABLE IF NOT EXISTS reconciliation_results (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      status TEXT NOT NULL, -- 'FULLY_VERIFIED', 'PAID_NOT_DELIVERED', 'DELIVERED_PAYMENT_UNCONFIRMED', 'AWAITING_PAYMENT', 'PURCHASE_BLOCKED', 'DUPLICATE_EVENT_IGNORED', 'DELIVERY_UNCONFIRMED'
      mismatch_category TEXT,
      evidence_summary TEXT NOT NULL,
      suggested_next_action TEXT NOT NULL,
      reconciled_at TEXT NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL UNIQUE,
      reconciliation_id TEXT NOT NULL,
      severity TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
      summary TEXT NOT NULL,
      status TEXT NOT NULL, -- 'OPEN', 'INVESTIGATING', 'PROPOSED', 'RESOLVED', 'DISMISSED'
      ai_explanation TEXT,
      ai_recommended_action TEXT,
      ai_uncertainties TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (purchase_id) REFERENCES purchases (id),
      FOREIGN KEY (reconciliation_id) REFERENCES reconciliation_results (id)
    );

    CREATE TABLE IF NOT EXISTS recovery_proposals (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      purchase_id TEXT NOT NULL,
      action_type TEXT NOT NULL, -- 'RETRY_PROVISIONING', 'PROBE_SERVICE', 'REVERIFY_DELIVERY', 'RECONCILE_PAYPAL', 'COMPENSATION_RECOMMENDATION'
      action_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      requires_human_approval INTEGER NOT NULL DEFAULT 1,
      approval_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      approved_by TEXT,
      execution_status TEXT NOT NULL DEFAULT 'NOT_EXECUTED', -- 'NOT_EXECUTED', 'EXECUTING', 'SUCCESS', 'FAILED'
      execution_result TEXT,
      created_at TEXT NOT NULL,
      executed_at TEXT,
      FOREIGN KEY (incident_id) REFERENCES incidents (id),
      FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    );

    CREATE TABLE IF NOT EXISTS evidence_records (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source_entity TEXT NOT NULL,
      payload TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      current_hash TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  seedDefaultDataIfEmpty();
}

export function computeSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function appendEvidenceRecord(
  purchaseId: string,
  eventType: string,
  sourceEntity: string,
  payloadObject: any
): string {
  const lastRecord = db
    .prepare(
      'SELECT current_hash FROM evidence_records WHERE purchase_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1'
    )
    .get(purchaseId) as { current_hash?: string } | undefined;

  const prevHash = lastRecord?.current_hash || '0000000000000000000000000000000000000000000000000000000000000000';
  const recordedAt = new Date().toISOString();
  const id = `EVD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const payloadStr = JSON.stringify(payloadObject);

  const hashInput = `${id}|${purchaseId}|${eventType}|${sourceEntity}|${payloadStr}|${prevHash}|${recordedAt}`;
  const currentHash = computeSha256(hashInput);

  db.prepare(`
    INSERT INTO evidence_records (id, purchase_id, event_type, source_entity, payload, prev_hash, current_hash, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, purchaseId, eventType, sourceEntity, payloadStr, prevHash, currentHash, recordedAt);

  return currentHash;
}

export function logAudit(action: string, operator: string, details?: any) {
  const id = `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO audit_logs (id, action, operator, details, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, action, operator, details ? JSON.stringify(details) : null, new Date().toISOString());
}

function seedDefaultDataIfEmpty() {
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
  if (agentCount.count > 0) return;

  const now = new Date();
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. CloudDeploy Agent
  db.prepare(`
    INSERT INTO agents (id, name, purpose, description, status, categories, max_amount, currency, allowed_merchants, auth_reference, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'agt_cloud_deploy',
    'CloudDeploy Agent',
    'Autonomous infrastructure provisioning & uptime monitoring subscriptions',
    'Certified DevOps purchasing subagent with hard limits for cloud reliability tools and telemetry endpoints.',
    'ACTIVE',
    JSON.stringify(['Cloud Services', 'Monitoring', 'Telemetry']),
    50.00,
    'USD',
    JSON.stringify(['CloudPulse Inc', 'ReliabilityOps LLC', 'Nexus Compute']),
    'AUTH-POLICY-DEVOPS-2026',
    now.toISOString(),
    oneMonthLater.toISOString()
  );

  // 2. InfrastructurePurchase Agent
  db.prepare(`
    INSERT INTO agents (id, name, purpose, description, status, categories, max_amount, currency, allowed_merchants, auth_reference, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'agt_infra_core',
    'InfrastructurePurchase Agent',
    'Dedicated high-throughput storage & compute slice acquisitions',
    'High-volume agent operating within deterministic batch allocations for clustered object storage and CDN tiers.',
    'ACTIVE',
    JSON.stringify(['Storage', 'Compute', 'CDN']),
    200.00,
    'USD',
    JSON.stringify(['Nexus Compute', 'HyperScale Storage', 'FastEdge Global']),
    'AUTH-POLICY-INFRA-2026',
    now.toISOString(),
    oneMonthLater.toISOString()
  );

  // 3. SoftwareLicense Agent
  db.prepare(`
    INSERT INTO agents (id, name, purpose, description, status, categories, max_amount, currency, allowed_merchants, auth_reference, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'agt_software_license',
    'SoftwareLicense Agent',
    'SaaS developer tools & API seat authorization',
    'Procures monthly seats for code inspection engines, vulnerability scanners, and translation toolkits.',
    'ACTIVE',
    JSON.stringify(['Software License', 'Developer Tools', 'Security']),
    120.00,
    'USD',
    JSON.stringify(['DevScan Security', 'ToolKit Cloud', 'Synapse Code']),
    'AUTH-POLICY-LICENSING-2026',
    now.toISOString(),
    oneMonthLater.toISOString()
  );

  logAudit('SYSTEM_BOOTSTRAP', 'SYSTEM', { message: 'Initialized PAYPILOT database with 3 demo agents' });
}
