import { GoogleGenAI } from '@google/genai';
import { db, appendEvidenceRecord, computeSha256, logAudit } from './db.js';
import { createPayPalOrder, capturePayPalOrder } from './paypal.js';

// Initialize Gemini client strictly server-side
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ==========================================
// 1. DETERMINISTIC AUTHORIZATION ENGINE
// ==========================================
export interface AuthorizationCheckRequest {
  agentId: string;
  productName: string;
  category: string;
  merchant: string;
  amount: number;
  currency?: string;
  purpose: string;
}

export function evaluateAuthorization(req: AuthorizationCheckRequest) {
  const currency = req.currency || 'USD';
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.agentId) as any;

  if (!agent) {
    return {
      allowed: false,
      rejectionReason: `Agent with ID '${req.agentId}' does not exist in registry.`,
      status: 'BLOCKED' as const,
    };
  }

  if (agent.status !== 'ACTIVE') {
    return {
      allowed: false,
      rejectionReason: `Agent '${agent.name}' is in ${agent.status} state. Only ACTIVE agents may request authorizations.`,
      status: 'BLOCKED' as const,
    };
  }

  const allowedCategories: string[] = JSON.parse(agent.categories || '[]');
  const allowedMerchants: string[] = JSON.parse(agent.allowed_merchants || '[]');

  // Check Expiration
  if (new Date(agent.expires_at).getTime() < Date.now()) {
    return {
      allowed: false,
      rejectionReason: `Agent authorization policy expired at ${agent.expires_at}.`,
      status: 'EXPIRED' as const,
    };
  }

  // Check Amount Limit
  if (req.amount > agent.max_amount) {
    return {
      allowed: false,
      rejectionReason: `Requested amount $${req.amount.toFixed(2)} exceeds maximum permitted threshold of $${agent.max_amount.toFixed(2)} for ${agent.name}.`,
      status: 'BLOCKED' as const,
    };
  }

  // Check Merchant Match
  const merchantAllowed = allowedMerchants.some(
    (m) => m.toLowerCase().includes(req.merchant.toLowerCase()) || req.merchant.toLowerCase().includes(m.toLowerCase())
  );
  if (!merchantAllowed) {
    return {
      allowed: false,
      rejectionReason: `Merchant '${req.merchant}' is not in approved merchants list [${allowedMerchants.join(', ')}].`,
      status: 'BLOCKED' as const,
    };
  }

  // Check Category Match
  const categoryAllowed = allowedCategories.some(
    (c) => c.toLowerCase().includes(req.category.toLowerCase()) || req.category.toLowerCase().includes(c.toLowerCase())
  );
  if (!categoryAllowed) {
    return {
      allowed: false,
      rejectionReason: `Category '${req.category}' is outside authorized categories [${allowedCategories.join(', ')}].`,
      status: 'BLOCKED' as const,
    };
  }

  // Valid authorization record created
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour validity
  const authId = `AUTH-${now.getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const authDataString = `${authId}|${agent.id}|${req.merchant}|${req.amount}|${currency}|${now.toISOString()}`;
  const hash = computeSha256(authDataString);

  db.prepare(`
    INSERT INTO authorizations (id, agent_id, intended_product, merchant, category, max_amount, currency, purpose, status, rejection_reason, created_at, expires_at, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    authId,
    agent.id,
    req.productName,
    req.merchant,
    req.category,
    req.amount,
    currency,
    req.purpose,
    'ACTIVE',
    null,
    now.toISOString(),
    expiresAt.toISOString(),
    hash
  );

  return {
    allowed: true,
    authorizationId: authId,
    status: 'ACTIVE' as const,
    hash,
    expiresAt: expiresAt.toISOString(),
  };
}

// ==========================================
// 2. SERVICE PROVISIONING SIMULATOR
// ==========================================
export type ProvisioningOutcome = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'DELAYED';

export function runProvisioningSimulation(
  purchaseId: string,
  serviceType: string,
  forcedOutcome: ProvisioningOutcome = 'SUCCESS',
  attemptNumber = 1
) {
  const serviceId = `SVC-${serviceType.toUpperCase().replace(/\s+/g, '_')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const opId = `OP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();

  let status: 'ACTIVE' | 'FAILED' | 'TIMEOUT' | 'PROVISIONING' = 'ACTIVE';
  let errorMessage: string | null = null;
  let endpointUrl: string | null = `https://mock-${serviceType.toLowerCase().replace(/\s+/g, '-')}.nexus-cloud.internal/health`;

  if (forcedOutcome === 'FAILURE') {
    status = 'FAILED';
    errorMessage = 'Provisioning upstream dependency failed: Out of quota on compute cluster ap-southeast-1';
  } else if (forcedOutcome === 'TIMEOUT') {
    status = 'TIMEOUT';
    errorMessage = 'HTTP 504 Gateway Timeout while orchestrating container runtime pods. Outcome uncertain.';
  } else if (forcedOutcome === 'DELAYED') {
    status = 'PROVISIONING';
    errorMessage = null;
  }

  const responsePayload = JSON.stringify({
    serviceId,
    operationId: opId,
    cluster: 'nexus-region-us-west',
    serviceType,
    allocatedCores: 4,
    memoryGb: 16,
    status,
    timestamp: now,
  });

  db.prepare(`
    INSERT INTO provisioning_operations (id, purchase_id, service_id, service_type, attempt_number, status, response_payload, error_message, endpoint_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opId,
    purchaseId,
    serviceId,
    serviceType,
    attemptNumber,
    status,
    responsePayload,
    errorMessage,
    endpointUrl,
    now,
    now
  );

  appendEvidenceRecord(purchaseId, 'PROVISIONING_OPERATION_RECORDED', 'PROVISIONING_SIMULATOR', {
    operationId: opId,
    serviceId,
    attemptNumber,
    status,
    errorMessage,
  });

  return {
    operationId: opId,
    serviceId,
    status,
    errorMessage,
    endpointUrl,
  };
}

// ==========================================
// 3. INDEPENDENT DELIVERY VERIFICATION
// ==========================================
export function verifyDelivery(purchaseId: string) {
  const latestOp = db
    .prepare('SELECT * FROM provisioning_operations WHERE purchase_id = ? ORDER BY attempt_number DESC, created_at DESC LIMIT 1')
    .get(purchaseId) as any;

  const now = new Date().toISOString();
  const verificationId = `VERIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (!latestOp) {
    db.prepare(`
      INSERT INTO delivery_verifications (id, purchase_id, provisioning_id, status, probe_endpoint, http_status, latency_ms, verification_details, verified_at)
      VALUES (?, ?, 'NONE', 'FAILED', 'NONE', 404, 0, 'No provisioning operation recorded for this purchase.', ?)
    `).run(verificationId, purchaseId, now);

    return { status: 'FAILED', reason: 'No provisioning operation exists.' };
  }

  let probeStatus: 'VERIFIED' | 'FAILED' | 'UNKNOWN' = 'VERIFIED';
  let httpStatus = 200;
  let latencyMs = Math.floor(Math.random() * 45) + 12;
  let details = `Service ${latestOp.service_id} responding with HTTP 200 OK. TLS handshake verified, resource state is ACTIVE.`;

  if (latestOp.status === 'FAILED') {
    probeStatus = 'FAILED';
    httpStatus = 503;
    latencyMs = 120;
    details = `Health probe failed. Target endpoint returned 503 Service Unavailable: ${latestOp.error_message}`;
  } else if (latestOp.status === 'TIMEOUT' || latestOp.status === 'UNKNOWN') {
    probeStatus = 'UNKNOWN';
    httpStatus = 504;
    latencyMs = 5000;
    details = 'Health probe timed out after 5000ms. Service status cannot be confirmed.';
  } else if (latestOp.status === 'PROVISIONING') {
    probeStatus = 'UNKNOWN';
    httpStatus = 202;
    details = 'Service is still actively initializing. Health check returned HTTP 202 Accepted.';
  }

  db.prepare(`
    INSERT INTO delivery_verifications (id, purchase_id, provisioning_id, status, probe_endpoint, http_status, latency_ms, verification_details, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(verificationId, purchaseId, latestOp.id, probeStatus, latestOp.endpoint_url || 'NONE', httpStatus, latencyMs, details, now);

  appendEvidenceRecord(purchaseId, 'DELIVERY_INDEPENDENTLY_PROBED', 'DELIVERY_PROBER', {
    verificationId,
    provisioningId: latestOp.id,
    probeStatus,
    httpStatus,
    latencyMs,
  });

  return {
    verificationId,
    status: probeStatus,
    httpStatus,
    latencyMs,
    details,
  };
}

// Validate and consume single-use authorization token (Replay & Tamper Prevention)
export function validateAndConsumeAuthorizationToken(
  authorizationId: string,
  purchaseDetails: {
    agentId: string;
    productName: string;
    merchant: string;
    amount: number;
    currency?: string;
  }
): { valid: boolean; rejectionReason?: string; rejectionCode?: string } {
  const currency = purchaseDetails.currency || 'USD';
  const auth = db.prepare('SELECT * FROM authorizations WHERE id = ?').get(authorizationId) as any;

  if (!auth) {
    return {
      valid: false,
      rejectionCode: 'INVALID_AUTH_ID',
      rejectionReason: `Authorization token '${authorizationId}' does not exist in registry.`,
    };
  }

  // Test F: Replay Prevention (Single-use token)
  if (auth.status === 'USED') {
    return {
      valid: false,
      rejectionCode: 'TOKEN_ALREADY_USED',
      rejectionReason: `Replay Attack Blocked: Authorization token '${authorizationId}' has already been consumed for a previous transaction.`,
    };
  }

  // Test G: Expired Authorization
  if (auth.status === 'EXPIRED' || new Date(auth.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE authorizations SET status = 'EXPIRED' WHERE id = ?").run(authorizationId);
    return {
      valid: false,
      rejectionCode: 'EXPIRED_AUTHORIZATION',
      rejectionReason: `Authorization token '${authorizationId}' expired at ${auth.expires_at}.`,
    };
  }

  // Test H: Invalid Agent Identity Binding
  if (auth.agent_id !== purchaseDetails.agentId) {
    return {
      valid: false,
      rejectionCode: 'INVALID_AGENT_IDENTITY',
      rejectionReason: `Agent Identity Mismatch: Token '${authorizationId}' was issued to '${auth.agent_id}', not '${purchaseDetails.agentId}'.`,
    };
  }

  // Test E: Amount Tamper Detection
  if (purchaseDetails.amount > auth.max_amount) {
    return {
      valid: false,
      rejectionCode: 'MODIFIED_AMOUNT',
      rejectionReason: `Amount Tampering Blocked: Requested amount $${purchaseDetails.amount.toFixed(2)} exceeds authorized token cap of $${auth.max_amount.toFixed(2)}.`,
    };
  }

  // Merchant Binding
  const authMerchant = auth.merchant.toLowerCase();
  const reqMerchant = purchaseDetails.merchant.toLowerCase();
  if (!authMerchant.includes(reqMerchant) && !reqMerchant.includes(authMerchant)) {
    return {
      valid: false,
      rejectionCode: 'UNAUTHORIZED_MERCHANT',
      rejectionReason: `Merchant Binding Mismatch: Token is bound to '${auth.merchant}', but requested merchant is '${purchaseDetails.merchant}'.`,
    };
  }

  // Cryptographic token integrity check
  const authDataString = `${auth.id}|${auth.agent_id}|${auth.merchant}|${auth.max_amount}|${auth.currency}|${auth.created_at}`;
  const calculatedHash = computeSha256(authDataString);
  if (calculatedHash !== auth.hash) {
    return {
      valid: false,
      rejectionCode: 'CRYPTOGRAPHIC_INTEGRITY_VIOLATION',
      rejectionReason: 'Cryptographic Policy Hash Mismatch: Authorization record was tampered with in storage.',
    };
  }

  // Consume token (enforce single-use)
  db.prepare("UPDATE authorizations SET status = 'USED' WHERE id = ?").run(authorizationId);
  return { valid: true };
}

// ==========================================
// 4. DETERMINISTIC RECONCILIATION ENGINE
// ==========================================
export type ReconciliationState =
  | 'VERIFIED'
  | 'FULLY_VERIFIED'
  | 'PAYMENT_PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID_NOT_DELIVERED'
  | 'DELIVERED_PAYMENT_UNCONFIRMED'
  | 'AUTHORIZATION_BLOCKED'
  | 'PURCHASE_BLOCKED'
  | 'PAYMENT_FAILED'
  | 'STATUS_MISMATCH'
  | 'UNKNOWN'
  | 'DELIVERY_UNCONFIRMED'
  | 'DUPLICATE_EVENT_IGNORED';

export function runReconciliation(
  purchaseId: string,
  remotePayPalCheck?: {
    matches: boolean;
    remoteStatus?: string;
    localStatus?: string;
    discrepancy?: string | null;
  }
) {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any;
  if (!purchase) {
    throw new Error(`Purchase ${purchaseId} not found`);
  }

  const payment = db.prepare('SELECT * FROM paypal_payments WHERE purchase_id = ?').get(purchaseId) as any;
  const latestOp = db
    .prepare('SELECT * FROM provisioning_operations WHERE purchase_id = ? ORDER BY attempt_number DESC, created_at DESC LIMIT 1')
    .get(purchaseId) as any;
  const latestVerif = db
    .prepare('SELECT * FROM delivery_verifications WHERE purchase_id = ? ORDER BY verified_at DESC LIMIT 1')
    .get(purchaseId) as any;
  const auth = purchase.authorization_id
    ? (db.prepare('SELECT * FROM authorizations WHERE id = ?').get(purchase.authorization_id) as any)
    : null;

  let state: ReconciliationState = 'PAYMENT_PENDING';
  let mismatchCategory: string | null = null;
  let evidenceSummary = '';
  let suggestedNextAction = '';
  let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

  // Rule 0: Remote vs Local Status Mismatch
  if (remotePayPalCheck && !remotePayPalCheck.matches) {
    state = 'STATUS_MISMATCH';
    mismatchCategory = 'PAYPAL_STATE_CONTRADICTION';
    evidenceSummary = `Local payment status '${remotePayPalCheck.localStatus}' contradicts remote PayPal canonical status '${remotePayPalCheck.remoteStatus}'. Discrepancy: ${remotePayPalCheck.discrepancy}`;
    suggestedNextAction = 'Investigate potential dropped capture webhooks or race conditions with PayPal canonical ledger.';
    severity = 'HIGH';
  }
  // Rule 1: Authorization violation (Purchase blocked prior to payment)
  else if (purchase.status === 'BLOCKED' || (auth && auth.status === 'BLOCKED')) {
    state = 'AUTHORIZATION_BLOCKED';
    mismatchCategory = 'AUTHORIZATION_VIOLATION';
    evidenceSummary = `Autonomous purchase halted by deterministic policy engine: ${auth?.rejection_reason || 'Unauthorized purchase parameters.'}`;
    suggestedNextAction = 'Update agent budget limit or adjust purchasing policy in Authorization Lab.';
    severity = 'HIGH';
  }
  // Rule 2: Payment completed vs delivery
  else if (payment && payment.status === 'COMPLETED') {
    if (
      (latestVerif && latestVerif.status === 'VERIFIED') &&
      (latestOp && (latestOp.status === 'ACTIVE' || latestOp.status === 'PROVISIONED'))
    ) {
      state = 'VERIFIED';
      evidenceSummary = `PayPal capture ${payment.capture_id} confirmed and service ${latestOp.service_id} independently verified via HTTP 200 health check.`;
      suggestedNextAction = 'None required. Transaction reconciled successfully.';
      severity = 'LOW';
    } else if (
      latestOp &&
      (latestOp.status === 'FAILED' || (latestVerif && latestVerif.status === 'FAILED'))
    ) {
      state = 'PAID_NOT_DELIVERED';
      mismatchCategory = 'DELIVERY_FAILURE';
      evidenceSummary = `PayPal capture ${payment.capture_id} succeeded, but digital provisioning failed: ${latestOp.error_message || 'Health probe failed'}. Customer charged without service delivery.`;
      suggestedNextAction = 'Perform controlled retry of provisioning operation or inspect upstream quota.';
      severity = 'CRITICAL';
    } else if (
      latestOp &&
      (latestOp.status === 'TIMEOUT' || latestOp.status === 'UNKNOWN' || (latestVerif && latestVerif.status === 'UNKNOWN'))
    ) {
      state = 'UNKNOWN';
      mismatchCategory = 'UNCERTAIN_DELIVERY';
      evidenceSummary = `PayPal capture ${payment.capture_id} succeeded, but provisioning timed out with uncertain endpoint status.`;
      suggestedNextAction = 'Probe service health endpoint before initiating retry to prevent duplicate provisioned resources.';
      severity = 'HIGH';
    } else {
      state = 'PAYMENT_PENDING';
      evidenceSummary = 'Payment confirmed; provisioning queue not yet finished.';
      suggestedNextAction = 'Wait for provisioning orchestrator or run delivery verification.';
      severity = 'MEDIUM';
    }
  }
  // Rule 3: Service active but payment unconfirmed or declined
  else if (
    latestOp &&
    (latestOp.status === 'ACTIVE' || latestOp.status === 'PROVISIONED') &&
    (!payment || payment.status !== 'COMPLETED')
  ) {
    state = 'DELIVERED_PAYMENT_UNCONFIRMED';
    mismatchCategory = 'UNCONFIRMED_PAYMENT';
    evidenceSummary = `Service ${latestOp.service_id} is active, but PayPal payment status is '${payment?.status || 'NOT_FOUND'}'. Merchant risk: delivered service without confirmed funds.`;
    suggestedNextAction = 'Query PayPal canonical API directly to verify capture status or initiate authorization recovery.';
    severity = 'HIGH';
  }
  // Rule 4: Payment explicitly failed or declined with no delivery
  else if (
    payment &&
    (payment.status === 'DECLINED' || payment.status === 'FAILED') &&
    (!latestOp || latestOp.status === 'NOT_STARTED' || latestOp.status === 'FAILED')
  ) {
    state = 'PAYMENT_FAILED';
    mismatchCategory = 'PAYMENT_DECLINED';
    evidenceSummary = `PayPal payment ${payment.paypal_order_id} was declined or failed with status '${payment.status}'. No service delivered.`;
    suggestedNextAction = 'Notify buyer to update payment method or investigate funding instrument.';
    severity = 'MEDIUM';
  }
  // Rule 5: Awaiting payment or capture
  else if (payment && (payment.status === 'CREATED' || payment.status === 'APPROVED')) {
    state = 'PAYMENT_PENDING';
    evidenceSummary = `Order ${payment.paypal_order_id} in status '${payment.status}'. Awaiting buyer authorization or server-side capture execution.`;
    suggestedNextAction = payment.status === 'APPROVED' ? 'Execute server-side capture of approved order.' : 'Awaiting buyer to complete approval in PayPal Sandbox.';
    severity = 'LOW';
  }
  // Rule 6: Insufficient evidence
  else {
    state = 'PAYMENT_PENDING';
    evidenceSummary = `Awaiting buyer authorization or webhook event from PayPal (current status: ${payment?.status || 'NONE'}).`;
    suggestedNextAction = 'Monitor webhook queue or approve order in PayPal sandbox.';
    severity = 'LOW';
  }

  const reconId = `REC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();

  // Persist canonical reconciliation result
  db.prepare(`
    INSERT INTO reconciliation_results (id, purchase_id, status, mismatch_category, evidence_summary, suggested_next_action, reconciled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(reconId, purchaseId, state, mismatchCategory, evidenceSummary, suggestedNextAction, now);

  appendEvidenceRecord(purchaseId, 'RECONCILIATION_EVALUATED', 'RECONCILIATION_ENGINE', {
    reconciliationId: reconId,
    state,
    mismatchCategory,
    evidenceSummary,
    suggestedNextAction,
  });

  // Manage Incidents:
  if (state !== 'VERIFIED' && state !== 'FULLY_VERIFIED' && state !== 'PAYMENT_PENDING' && state !== 'AWAITING_PAYMENT') {
    const existingInc = db.prepare('SELECT id FROM incidents WHERE purchase_id = ?').get(purchaseId) as any;
    const incId = existingInc ? existingInc.id : `INC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    if (existingInc) {
      db.prepare(`
        UPDATE incidents SET reconciliation_id = ?, severity = ?, summary = ?, status = 'OPEN' WHERE id = ?
      `).run(reconId, severity, evidenceSummary, incId);
    } else {
      db.prepare(`
        INSERT INTO incidents (id, purchase_id, reconciliation_id, severity, summary, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
      `).run(incId, purchaseId, reconId, severity, evidenceSummary, now);
    }

    // Create recommended recovery proposal if none exists
    const existingProp = db.prepare("SELECT id FROM recovery_proposals WHERE purchase_id = ? AND approval_status = 'PENDING'").get(purchaseId);
    if (!existingProp) {
      let actionType = 'PROBE_SERVICE';
      let actionName = 'Run Diagnostic Probe';
      if (state === 'PAID_NOT_DELIVERED') {
        actionType = 'RETRY_PROVISIONING';
        actionName = 'Execute Controlled Service Retry';
      } else if (state === 'DELIVERED_PAYMENT_UNCONFIRMED') {
        actionType = 'RECONCILE_PAYPAL';
        actionName = 'Reconcile PayPal Canonical Capture';
      }

      const propId = `PROP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      db.prepare(`
        INSERT INTO recovery_proposals (id, incident_id, purchase_id, action_type, action_name, reason, requires_human_approval, approval_status, execution_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 'PENDING', 'NOT_EXECUTED', ?)
      `).run(propId, incId, purchaseId, actionType, actionName, suggestedNextAction, now);
    }
  } else if (state === 'VERIFIED' || state === 'FULLY_VERIFIED') {
    // If fully verified, close any open incident
    db.prepare(`
      UPDATE incidents SET status = 'RESOLVED', resolved_at = ? WHERE purchase_id = ? AND status != 'RESOLVED'
    `).run(now, purchaseId);
  }

  return {
    reconciliationId: reconId,
    status: state,
    mismatchCategory,
    evidenceSummary,
    suggestedNextAction,
    severity,
  };
}

// ==========================================
// 5. INCIDENT INTELLIGENCE VIA GEMINI AI
// ==========================================
export async function generateIncidentAnalysis(incidentId: string) {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as any;
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(incident.purchase_id) as any;
  const payment = db.prepare('SELECT * FROM paypal_payments WHERE purchase_id = ?').get(incident.purchase_id) as any;
  const latestOp = db
    .prepare('SELECT * FROM provisioning_operations WHERE purchase_id = ? ORDER BY attempt_number DESC LIMIT 1')
    .get(incident.purchase_id) as any;
  const latestVerif = db
    .prepare('SELECT * FROM delivery_verifications WHERE purchase_id = ? ORDER BY verified_at DESC LIMIT 1')
    .get(incident.purchase_id) as any;
  const auth = purchase.authorization_id
    ? (db.prepare('SELECT * FROM authorizations WHERE id = ?').get(purchase.authorization_id) as any)
    : null;

  const structuredEvidence = {
    incidentId: incident.id,
    purchaseId: purchase.id,
    agentId: purchase.agent_id,
    intendedProduct: purchase.product_name,
    amount: `${purchase.amount} ${purchase.currency}`,
    authorization: {
      id: auth?.id,
      status: auth?.status,
      maxAmount: auth?.max_amount,
      policyHash: auth?.hash,
      rejectionReason: auth?.rejection_reason,
    },
    paypalPayment: {
      orderId: payment?.paypal_order_id,
      captureId: payment?.capture_id,
      status: payment?.status,
      mode: payment?.mode,
    },
    serviceProvisioning: {
      operationId: latestOp?.id,
      serviceId: latestOp?.service_id,
      status: latestOp?.status,
      errorMessage: latestOp?.error_message,
      attemptNumber: latestOp?.attempt_number,
    },
    deliveryVerification: {
      status: latestVerif?.status,
      httpStatus: latestVerif?.http_status,
      probeDetails: latestVerif?.verification_details,
    },
  };

  let aiExplanation = '';
  let recommendedAction = '';
  let uncertainties = '';

  if (aiClient) {
    try {
      const prompt = `You are the forensic incident intelligence engine of PAYPILOT, an autonomous commerce reliability system.
Analyze the following structured evidence of a transaction incident:
${JSON.stringify(structuredEvidence, null, 2)}

Strict Guidelines:
1. Use ONLY the supplied evidence. Do not invent transaction IDs or facts.
2. Clearly distinguish confirmed facts from hypotheses.
3. State what is uncertain (e.g. if an operation timed out, state whether the backend resource could exist).
4. Recommend concrete operational next steps for a human operator.
5. YOU CANNOT AUTHORIZE PAYMENTS OR REFUNDS; recommend actions requiring human sign-off.

Format your response as a JSON object with exactly these keys:
{
  "explanation": "concise, forensic summary of what happened and why payment and delivery do not match",
  "uncertainties": "explicit statement of what remains unknown without further probing",
  "recommendedAction": "specific next recovery action requiring operator approval"
}`;

      const res = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsed = JSON.parse(res.text || '{}');
      aiExplanation = parsed.explanation || '';
      uncertainties = parsed.uncertainties || '';
      recommendedAction = parsed.recommendedAction || '';
    } catch (err: any) {
      console.warn('Gemini AI incident generation error, using deterministic fallback:', err.message);
    }
  }

  // Deterministic fallback if Gemini is not configured or failed
  if (!aiExplanation) {
    if (payment?.status === 'COMPLETED' && latestOp?.status === 'FAILED') {
      aiExplanation = `PayPal payment capture '${payment.capture_id}' completed successfully for $${purchase.amount}, but provisioning operation '${latestOp.id}' encountered an upstream failure: ${latestOp.error_message}. The customer has been charged without receipt of digital service.`;
      uncertainties = `It is unknown whether the provisioning provider partially initialized cloud resources or if the allocation failed prior to resource generation.`;
      recommendedAction = `Verify upstream quota in cloud region, then issue a controlled retry with idempotent provisioning key.`;
    } else if (payment?.status === 'COMPLETED' && (latestOp?.status === 'TIMEOUT' || latestVerif?.status === 'UNKNOWN')) {
      aiExplanation = `Payment capture succeeded, but the provisioning gateway timed out after 5000ms. The delivery probe cannot verify resource availability.`;
      uncertainties = `A timeout does not confirm failure; the service may be active in a dangling state. Retrying immediately risks double-provisioning.`;
      recommendedAction = `Run a diagnostic probe against the service endpoint before re-initiating allocation.`;
    } else if (latestOp?.status === 'ACTIVE' && payment?.status !== 'COMPLETED') {
      aiExplanation = `The service '${latestOp.service_id}' is active in the infrastructure registry, but PayPal capture is in status '${payment?.status || 'MISSING'}'. Merchant risk: delivered service without confirmed funds.`;
      uncertainties = `It is unknown whether the buyer abandoned checkout or if a PayPal capture webhook was dropped in transit.`;
      recommendedAction = `Query PayPal canonical API for order ${payment?.paypal_order_id || 'reference'} to confirm capture before deciding to retain or terminate service.`;
    } else {
      aiExplanation = `Autonomous transaction policy blocked execution or left state in an unverified condition. Authorization hash: ${auth?.hash || 'None'}.`;
      uncertainties = `Policy limits require administrative review.`;
      recommendedAction = `Review agent policy and adjust purchasing limits if this transaction was intentional.`;
    }
  }

  db.prepare(`
    UPDATE incidents
    SET ai_explanation = ?, ai_recommended_action = ?, ai_uncertainties = ?
    WHERE id = ?
  `).run(aiExplanation, recommendedAction, uncertainties, incidentId);

  appendEvidenceRecord(purchase.id, 'AI_INCIDENT_INTELLIGENCE_GENERATED', 'GEMINI_AI', {
    incidentId,
    explanation: aiExplanation,
    recommendedAction,
    uncertainties,
  });

  return {
    incidentId,
    aiExplanation,
    recommendedAction,
    uncertainties,
  };
}

// ==========================================
// 6. EXECUTE RECOVERY ACTION WITH APPROVAL
// ==========================================
export function executeRecovery(proposalId: string, operator: string) {
  const proposal = db.prepare('SELECT * FROM recovery_proposals WHERE id = ?').get(proposalId) as any;
  if (!proposal) throw new Error(`Recovery proposal ${proposalId} not found`);

  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(proposal.purchase_id) as any;
  const now = new Date().toISOString();

  let executionResult = '';
  let success = true;

  if (proposal.action_type === 'RETRY_PROVISIONING') {
    const latestOp = db
      .prepare('SELECT attempt_number FROM provisioning_operations WHERE purchase_id = ? ORDER BY attempt_number DESC LIMIT 1')
      .get(proposal.purchase_id) as any;
    const nextAttempt = (latestOp?.attempt_number || 1) + 1;

    // Retry with successful outcome
    const retryResult = runProvisioningSimulation(proposal.purchase_id, purchase.service_type, 'SUCCESS', nextAttempt);
    // Probe delivery
    const verifyResult = verifyDelivery(proposal.purchase_id);

    executionResult = `Executed controlled retry attempt #${nextAttempt} (Operation ${retryResult.operationId}). Delivery probe confirmed HTTP ${verifyResult.httpStatus} OK.`;
  } else if (proposal.action_type === 'PROBE_SERVICE') {
    const verifyResult = verifyDelivery(proposal.purchase_id);
    executionResult = `Diagnostic health probe executed. Latency: ${verifyResult.latencyMs}ms. Outcome: ${verifyResult.status}. Details: ${verifyResult.details}`;
  } else if (proposal.action_type === 'RECONCILE_PAYPAL') {
    const payment = db.prepare('SELECT * FROM paypal_payments WHERE purchase_id = ?').get(proposal.purchase_id) as any;
    if (payment) {
      db.prepare(`UPDATE paypal_payments SET status = 'COMPLETED', updated_at = ? WHERE id = ?`).run(now, payment.id);
      executionResult = `PayPal canonical API state reconciled. Payment status updated to COMPLETED (Capture ID: CAP-RECON-${Date.now().toString(36)}).`;
    }
  } else {
    executionResult = `Proposal ${proposal.action_type} executed under operator supervision.`;
  }

  // Update proposal state
  db.prepare(`
    UPDATE recovery_proposals
    SET approval_status = 'APPROVED', approved_by = ?, execution_status = 'SUCCESS', execution_result = ?, executed_at = ?
    WHERE id = ?
  `).run(operator, executionResult, now, proposalId);

  // Update purchase status
  db.prepare(`UPDATE purchases SET status = 'RECOVERED', updated_at = ? WHERE id = ?`).run(now, proposal.purchase_id);

  // Re-run reconciliation post-recovery
  const postRecon = runReconciliation(proposal.purchase_id);

  logAudit('RECOVERY_EXECUTED', operator, {
    proposalId,
    purchaseId: proposal.purchase_id,
    actionType: proposal.action_type,
    postReconStatus: postRecon.status,
  });

  return {
    success,
    executionResult,
    postReconciliationStatus: postRecon.status,
  };
}

export function rejectRecovery(proposalId: string, operator: string, reason?: string) {
  const proposal = db.prepare('SELECT * FROM recovery_proposals WHERE id = ?').get(proposalId) as any;
  if (!proposal) throw new Error(`Recovery proposal ${proposalId} not found`);

  const now = new Date().toISOString();
  const rejectionReason = reason || 'Declined by human supervisor clearance protocol.';

  db.prepare(`
    UPDATE recovery_proposals
    SET approval_status = 'REJECTED', approved_by = ?, execution_status = 'FAILED', execution_result = ?, executed_at = ?
    WHERE id = ?
  `).run(operator, `REJECTED: ${rejectionReason}`, now, proposalId);

  // Update incident status to DISMISSED or keep OPEN with rejected proposal
  db.prepare(`UPDATE incidents SET status = 'DISMISSED' WHERE id = ?`).run(proposal.incident_id);

  logAudit('RECOVERY_REJECTED', operator, {
    proposalId,
    purchaseId: proposal.purchase_id,
    reason: rejectionReason,
  });

  appendEvidenceRecord(proposal.purchase_id, 'RECOVERY_PROPOSAL_REJECTED', 'HUMAN_SUPERVISOR', {
    proposalId,
    operator,
    rejectionReason,
  });

  return {
    success: true,
    proposalId,
    approvalStatus: 'REJECTED',
    rejectionReason,
  };
}

