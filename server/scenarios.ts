import { db, appendEvidenceRecord, logAudit } from './db.js';
import {
  evaluateAuthorization,
  runProvisioningSimulation,
  verifyDelivery,
  runReconciliation,
  generateIncidentAnalysis,
} from './engine.js';
import { createPayPalOrder, capturePayPalOrder } from './paypal.js';

export async function runPresetScenario(scenarioNumber: 1 | 2 | 3 | 4) {
  const now = new Date().toISOString();

  if (scenarioNumber === 1) {
    // SCENARIO 1: FULLY_VERIFIED
    // Agent: CloudDeploy Agent -> Monitoring Starter ($30.00) -> PayPal COMPLETED -> Provisioning ACTIVE -> Verified
    const purchaseId = `PUR-SCN1-${Date.now().toString(36).toUpperCase()}`;

    // 1. Authorization
    const authResult = evaluateAuthorization({
      agentId: 'agt_cloud_deploy',
      productName: 'Cloud Monitoring Starter Tier',
      category: 'Monitoring',
      merchant: 'CloudPulse Inc',
      amount: 30.0,
      currency: 'USD',
      purpose: 'Real-time telemetry ingestion node for Q4 edge cluster',
    });

    // 2. Purchase Record
    db.prepare(`
      INSERT INTO purchases (id, agent_id, authorization_id, product_name, service_type, merchant, amount, currency, status, scenario_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseId,
      'agt_cloud_deploy',
      authResult.authorizationId,
      'Cloud Monitoring Starter Tier',
      'Cloud Monitoring Service',
      'CloudPulse Inc',
      30.0,
      'USD',
      'PENDING',
      'DEMO_1_SUCCESS',
      now,
      now
    );

    appendEvidenceRecord(purchaseId, 'PURCHASE_INITIATED', 'AGENT_RUNNER', {
      purchaseId,
      agentId: 'agt_cloud_deploy',
      amount: 30.0,
      authorizationId: authResult.authorizationId,
    });

    // 3. PayPal Order & Capture
    const order = await createPayPalOrder({
      purchaseId,
      amount: 30.0,
      currency: 'USD',
      productName: 'Cloud Monitoring Starter Tier',
    });

    const capture = await capturePayPalOrder(order.orderId, purchaseId);

    db.prepare(`
      INSERT INTO paypal_payments (id, purchase_id, paypal_order_id, capture_id, amount, currency, status, mode, raw_response, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `PAY-${Date.now().toString(36)}`,
      purchaseId,
      order.orderId,
      capture.captureId,
      30.0,
      'USD',
      'COMPLETED',
      capture.mode,
      JSON.stringify(capture.raw),
      now,
      now
    );

    appendEvidenceRecord(purchaseId, 'PAYPAL_PAYMENT_CAPTURED', 'PAYPAL_ADAPTER', {
      orderId: order.orderId,
      captureId: capture.captureId,
      amount: 30.0,
      status: 'COMPLETED',
    });

    // 4. Provisioning (SUCCESS)
    const prov = runProvisioningSimulation(purchaseId, 'Cloud Monitoring Service', 'SUCCESS', 1);

    // 5. Delivery Verification
    verifyDelivery(purchaseId);

    // 6. Reconciliation
    const recon = runReconciliation(purchaseId);

    logAudit('SCENARIO_RUN', 'DEMO_RUNNER', { scenario: 'SCENARIO_1_SUCCESSFUL', purchaseId, status: recon.status });
    return { purchaseId, scenario: 1, status: recon.status };
  } else if (scenarioNumber === 2) {
    // SCENARIO 2: PAID_NOT_DELIVERED
    // CloudDeploy Agent -> Compute Instance ($45.00) -> PayPal COMPLETED -> Provisioning TIMEOUT/FAILED -> Delivery FAILED -> Incident Created
    const purchaseId = `PUR-SCN2-${Date.now().toString(36).toUpperCase()}`;

    const authResult = evaluateAuthorization({
      agentId: 'agt_cloud_deploy',
      productName: 'DevOps Micro Compute Node',
      category: 'Cloud Services',
      merchant: 'Nexus Compute',
      amount: 45.0,
      currency: 'USD',
      purpose: 'Ephemeral build container runner',
    });

    db.prepare(`
      INSERT INTO purchases (id, agent_id, authorization_id, product_name, service_type, merchant, amount, currency, status, scenario_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseId,
      'agt_cloud_deploy',
      authResult.authorizationId,
      'DevOps Micro Compute Node',
      'Compute Service',
      'Nexus Compute',
      45.0,
      'USD',
      'PENDING',
      'DEMO_2_PAID_NOT_DELIVERED',
      now,
      now
    );

    appendEvidenceRecord(purchaseId, 'PURCHASE_INITIATED', 'AGENT_RUNNER', {
      purchaseId,
      agentId: 'agt_cloud_deploy',
      amount: 45.0,
      authorizationId: authResult.authorizationId,
    });

    // PayPal Capture Succeeds
    const order = await createPayPalOrder({
      purchaseId,
      amount: 45.0,
      currency: 'USD',
      productName: 'DevOps Micro Compute Node',
    });
    const capture = await capturePayPalOrder(order.orderId, purchaseId);

    db.prepare(`
      INSERT INTO paypal_payments (id, purchase_id, paypal_order_id, capture_id, amount, currency, status, mode, raw_response, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `PAY-${Date.now().toString(36)}`,
      purchaseId,
      order.orderId,
      capture.captureId,
      45.0,
      'USD',
      'COMPLETED',
      capture.mode,
      JSON.stringify(capture.raw),
      now,
      now
    );

    appendEvidenceRecord(purchaseId, 'PAYPAL_PAYMENT_CAPTURED', 'PAYPAL_ADAPTER', {
      orderId: order.orderId,
      captureId: capture.captureId,
      amount: 45.0,
      status: 'COMPLETED',
    });

    // Provisioning FAILS (Upstream quota or timeout)
    runProvisioningSimulation(purchaseId, 'Compute Service', 'FAILURE', 1);

    // Delivery probe FAILS
    verifyDelivery(purchaseId);

    // Reconcile -> Creates incident
    const recon = runReconciliation(purchaseId);

    // Auto-generate AI analysis
    const incident = db.prepare('SELECT id FROM incidents WHERE purchase_id = ?').get(purchaseId) as any;
    if (incident) {
      await generateIncidentAnalysis(incident.id);
    }

    logAudit('SCENARIO_RUN', 'DEMO_RUNNER', { scenario: 'SCENARIO_2_PAID_NOT_DELIVERED', purchaseId, status: recon.status });
    return { purchaseId, scenario: 2, status: recon.status };
  } else if (scenarioNumber === 3) {
    // SCENARIO 3: DELIVERED_PAYMENT_UNCONFIRMED
    // InfrastructurePurchase Agent -> Clustered NVMe Storage ($150.00) -> Provisioning ACTIVE -> PayPal FAILED/PENDING
    const purchaseId = `PUR-SCN3-${Date.now().toString(36).toUpperCase()}`;

    const authResult = evaluateAuthorization({
      agentId: 'agt_infra_core',
      productName: 'High-Throughput NVMe Object Storage (1TB)',
      category: 'Storage',
      merchant: 'HyperScale Storage',
      amount: 150.0,
      currency: 'USD',
      purpose: 'Log warehouse cold storage bucket',
    });

    db.prepare(`
      INSERT INTO purchases (id, agent_id, authorization_id, product_name, service_type, merchant, amount, currency, status, scenario_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseId,
      'agt_infra_core',
      authResult.authorizationId,
      'High-Throughput NVMe Object Storage (1TB)',
      'Storage Service',
      'HyperScale Storage',
      150.0,
      'USD',
      'PENDING',
      'DEMO_3_UNCONFIRMED_PAYMENT',
      now,
      now
    );

    // PayPal payment recorded as FAILED or DECLINED
    const mockOrderId = `ORD-DECLINED-${Date.now().toString(36).toUpperCase()}`;
    db.prepare(`
      INSERT INTO paypal_payments (id, purchase_id, paypal_order_id, capture_id, amount, currency, status, mode, raw_response, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `PAY-${Date.now().toString(36)}`,
      purchaseId,
      mockOrderId,
      null,
      150.0,
      'USD',
      'DECLINED',
      'DEMO',
      JSON.stringify({ status: 'DECLINED', reason: 'INSTRUMENT_DECLINED' }),
      now,
      now
    );

    appendEvidenceRecord(purchaseId, 'PAYPAL_PAYMENT_DECLINED', 'PAYPAL_ADAPTER', {
      orderId: mockOrderId,
      status: 'DECLINED',
      reason: 'INSTRUMENT_DECLINED',
    });

    // But Service Provisioning completed!
    runProvisioningSimulation(purchaseId, 'Storage Service', 'SUCCESS', 1);

    // Delivery verified
    verifyDelivery(purchaseId);

    // Reconcile -> Creates incident
    const recon = runReconciliation(purchaseId);
    const incident = db.prepare('SELECT id FROM incidents WHERE purchase_id = ?').get(purchaseId) as any;
    if (incident) {
      await generateIncidentAnalysis(incident.id);
    }

    logAudit('SCENARIO_RUN', 'DEMO_RUNNER', { scenario: 'SCENARIO_3_DELIVERED_PAYMENT_UNCONFIRMED', purchaseId, status: recon.status });
    return { purchaseId, scenario: 3, status: recon.status };
  } else {
    // SCENARIO 4: PURCHASE_BLOCKED (Authorization violation)
    // SoftwareLicense Agent has $120 max amount; attempts $299 enterprise license purchase
    const purchaseId = `PUR-SCN4-${Date.now().toString(36).toUpperCase()}`;

    const authResult = evaluateAuthorization({
      agentId: 'agt_software_license',
      productName: 'Enterprise Security Code Scanner Suite',
      category: 'Security',
      merchant: 'DevScan Security',
      amount: 299.0, // Exceeds $120 limit
      currency: 'USD',
      purpose: 'Unrestricted enterprise multi-seat license',
    });

    db.prepare(`
      INSERT INTO purchases (id, agent_id, authorization_id, product_name, service_type, merchant, amount, currency, status, scenario_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseId,
      'agt_software_license',
      authResult.authorizationId || null,
      'Enterprise Security Code Scanner Suite',
      'Software Subscription',
      'DevScan Security',
      299.0,
      'USD',
      'BLOCKED',
      'DEMO_4_AUTH_VIOLATION',
      now,
      now
    );

    appendEvidenceRecord(purchaseId, 'PURCHASE_POLICY_BLOCKED', 'AUTHORIZATION_ENGINE', {
      purchaseId,
      agentId: 'agt_software_license',
      amount: 299.0,
      rejectionReason: authResult.rejectionReason,
    });

    const recon = runReconciliation(purchaseId);

    logAudit('SCENARIO_RUN', 'DEMO_RUNNER', { scenario: 'SCENARIO_4_AUTH_VIOLATION', purchaseId, status: recon.status });
    return { purchaseId, scenario: 4, status: recon.status };
  }
}

export function seedDemoScenariosIfEmpty() {
  const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchases').get() as { count: number };
  if (purchaseCount.count === 0) {
    // Run scenario 1, 2, and 3 so the dashboard has rich, realistic data right upon launch!
    runPresetScenario(1);
    runPresetScenario(2);
    runPresetScenario(3);
    runPresetScenario(4);
  }
}
