export interface Agent {
  id: string;
  name: string;
  purpose: string;
  description: string;
  status: 'ACTIVE' | 'DISABLED';
  categories: string[];
  max_amount: number;
  currency: string;
  allowed_merchants: string[];
  auth_reference: string;
  created_at: string;
  expires_at: string;
}

export interface Authorization {
  id: string;
  agent_id: string;
  agent_name?: string;
  intended_product: string;
  merchant: string;
  category: string;
  max_amount: number;
  currency: string;
  purpose: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'BLOCKED';
  rejection_reason?: string | null;
  created_at: string;
  expires_at: string;
  hash: string;
}

export type ReconciliationState =
  | 'FULLY_VERIFIED'
  | 'PAID_NOT_DELIVERED'
  | 'DELIVERED_PAYMENT_UNCONFIRMED'
  | 'AWAITING_PAYMENT'
  | 'PURCHASE_BLOCKED'
  | 'DUPLICATE_EVENT_IGNORED'
  | 'DELIVERY_UNCONFIRMED';

export interface PurchaseItem {
  id: string;
  agent_id: string;
  agent_name: string;
  authorization_id?: string | null;
  product_name: string;
  service_type: string;
  merchant: string;
  amount: number;
  currency: string;
  status: string;
  scenario_tag?: string;
  created_at: string;
  updated_at: string;
  reconciliation_status?: ReconciliationState;
  mismatch_category?: string;
  payment_status?: string;
  paypal_order_id?: string;
  capture_id?: string;
  payment_mode?: 'LIVE_SANDBOX' | 'DEMO';
  provisioning_status?: string;
  service_id?: string;
  delivery_status?: string;
  incident_id?: string;
  incident_status?: string;
  incident_severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PurchaseDetail {
  purchase: PurchaseItem;
  authorization?: Authorization | null;
  payment?: {
    id: string;
    paypal_order_id: string;
    capture_id?: string;
    amount: number;
    currency: string;
    status: string;
    mode: 'LIVE_SANDBOX' | 'DEMO';
    raw_response?: string;
    created_at: string;
  } | null;
  webhooks: Array<{
    id: string;
    event_type: string;
    resource_type: string;
    signature_status: string;
    payload: any;
    is_duplicate: number;
    received_at: string;
  }>;
  provisioningOperations: Array<{
    id: string;
    service_id: string;
    service_type: string;
    attempt_number: number;
    status: string;
    response_payload: any;
    error_message?: string;
    endpoint_url?: string;
    created_at: string;
  }>;
  verifications: Array<{
    id: string;
    provisioning_id: string;
    status: string;
    probe_endpoint: string;
    http_status: number;
    latency_ms: number;
    verification_details: string;
    verified_at: string;
  }>;
  reconciliations: Array<{
    id: string;
    status: ReconciliationState;
    mismatch_category?: string;
    evidence_summary: string;
    suggested_next_action: string;
    reconciled_at: string;
  }>;
  incident?: Incident | null;
  recoveryProposals: RecoveryProposal[];
  evidenceRecords: EvidenceRecord[];
}

export interface Incident {
  id: string;
  purchase_id: string;
  product_name?: string;
  amount?: number;
  currency?: string;
  agent_name?: string;
  reconciliation_id: string;
  reconciliation_status?: ReconciliationState;
  mismatch_category?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  status: 'OPEN' | 'INVESTIGATING' | 'PROPOSED' | 'RESOLVED' | 'DISMISSED';
  ai_explanation?: string;
  ai_recommended_action?: string;
  ai_uncertainties?: string;
  created_at: string;
  resolved_at?: string;
}

export interface RecoveryProposal {
  id: string;
  incident_id: string;
  purchase_id: string;
  product_name?: string;
  amount?: number;
  currency?: string;
  agent_name?: string;
  incident_summary?: string;
  severity?: string;
  action_type: 'RETRY_PROVISIONING' | 'PROBE_SERVICE' | 'REVERIFY_DELIVERY' | 'RECONCILE_PAYPAL' | 'COMPENSATION_RECOMMENDATION';
  action_name: string;
  reason: string;
  requires_human_approval: number;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
  execution_status: 'NOT_EXECUTED' | 'EXECUTING' | 'SUCCESS' | 'FAILED';
  execution_result?: string;
  created_at: string;
  executed_at?: string;
}

export interface EvidenceRecord {
  id: string;
  purchase_id: string;
  event_type: string;
  source_entity: string;
  payload: any;
  prev_hash: string;
  current_hash: string;
  recorded_at: string;
}

export interface IntegrationsState {
  paypal: { name: string; status: string; mode: string; details: string };
  gemini: { name: string; status: string; details: string };
  sqlite: { name: string; status: string; details: string };
  simulator: { name: string; status: string; details: string };
}
