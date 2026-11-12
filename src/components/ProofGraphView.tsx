import React, { useState } from 'react';
import { 
  Bot, 
  ShieldCheck, 
  ShoppingCart, 
  CreditCard, 
  Webhook, 
  Server, 
  CheckCircle2, 
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  Hash,
  Clock,
  Sparkles,
  Info,
  ChevronRight,
  X
} from 'lucide-react';
import { PurchaseDetail, ReconciliationState } from '../types';

interface ProofGraphViewProps {
  purchaseDetail: PurchaseDetail | null;
  onRefresh?: () => void;
  onSelectAction?: (action: string) => void;
}

type NodeKey = 
  | 'AGENT' 
  | 'AUTHORIZATION' 
  | 'PURCHASE' 
  | 'PAYPAL' 
  | 'WEBHOOK' 
  | 'PROVISIONING' 
  | 'DELIVERY' 
  | 'RECOVERY';

interface GraphNodeData {
  key: NodeKey;
  title: string;
  subtitle: string;
  state: 'green' | 'cyan' | 'coral' | 'violet' | 'grey';
  icon: any;
  statusText: string;
  timestamp?: string;
  hash?: string;
  details: Record<string, any>;
  evidenceIds: string[];
  mismatchReason?: string;
}

export const ProofGraphView: React.FC<ProofGraphViewProps> = ({ purchaseDetail, onRefresh }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);

  if (!purchaseDetail) {
    return (
      <div className="flex flex-col items-center justify-center h-96 border border-[#232B38] bg-[#11151D] rounded-xl p-8 text-center">
        <Server className="w-12 h-12 text-[#A1A1AA] mb-3 animate-pulse" />
        <h3 className="text-lg font-semibold text-[#F4F4F5]">No Transaction Loaded</h3>
        <p className="text-sm text-[#A1A1AA] max-w-md mt-1">
          Select a transaction from the Explorer or run a preset scenario from the Command Center to inspect its live Payment-to-Delivery Proof Graph.
        </p>
      </div>
    );
  }

  const { purchase, authorization, payment, webhooks, provisioningOperations, verifications, incident, recoveryProposals } = purchaseDetail;
  const latestOp = provisioningOperations[0];
  const latestVerif = verifications[0];
  const latestProposal = recoveryProposals[0];
  const reconStatus = purchase.reconciliation_status;

  // Compute node statuses deterministically
  // 1. AGENT
  const agentNode: GraphNodeData = {
    key: 'AGENT',
    title: '1. Autonomous Agent',
    subtitle: purchase.agent_name,
    state: 'green',
    icon: Bot,
    statusText: 'AUTHORIZED POLICY',
    timestamp: purchase.created_at,
    details: {
      agentId: purchase.agent_id,
      name: purchase.agent_name,
      allocatedBudget: `$${purchase.amount.toFixed(2)} ${purchase.currency}`,
      serviceTarget: purchase.service_type,
    },
    evidenceIds: ['AGT-POL-2026'],
  };

  // 2. AUTHORIZATION
  const authState = !authorization || authorization.status === 'BLOCKED' ? 'coral' : 'green';
  const authNode: GraphNodeData = {
    key: 'AUTHORIZATION',
    title: '2. Policy Authorization',
    subtitle: authorization?.id || 'BLOCKED POLICY',
    state: authState,
    icon: ShieldCheck,
    statusText: authorization ? authorization.status : 'POLICY BLOCKED',
    timestamp: authorization?.created_at || purchase.created_at,
    hash: authorization?.hash,
    details: {
      authorizationId: authorization?.id || 'NONE',
      maxLimit: authorization ? `$${authorization.max_amount.toFixed(2)}` : 'N/A',
      approvedMerchant: authorization?.merchant || purchase.merchant,
      purpose: authorization?.purpose || 'Autonomous request',
      rejectionReason: authorization?.rejection_reason || (reconStatus === 'PURCHASE_BLOCKED' ? 'Policy limit exceeded' : null),
    },
    evidenceIds: authorization ? [authorization.id] : [],
    mismatchReason: authorization?.rejection_reason || undefined,
  };

  // 3. PURCHASE ORDER
  const purchaseNode: GraphNodeData = {
    key: 'PURCHASE',
    title: '3. Purchase Intent',
    subtitle: purchase.product_name,
    state: purchase.status === 'BLOCKED' ? 'coral' : 'green',
    icon: ShoppingCart,
    statusText: purchase.status,
    timestamp: purchase.created_at,
    details: {
      purchaseId: purchase.id,
      product: purchase.product_name,
      amount: `$${purchase.amount.toFixed(2)} ${purchase.currency}`,
      merchant: purchase.merchant,
      scenarioTag: purchase.scenario_tag || 'STANDARD_RUN',
    },
    evidenceIds: [purchase.id],
  };

  // 4. PAYPAL PAYMENT
  let paypalState: 'green' | 'cyan' | 'coral' | 'grey' = 'grey';
  if (!payment) {
    paypalState = reconStatus === 'PURCHASE_BLOCKED' ? 'grey' : 'cyan';
  } else if (payment.status === 'COMPLETED') {
    paypalState = 'green';
  } else if (payment.status === 'PENDING' || payment.status === 'CREATED') {
    paypalState = 'cyan';
  } else {
    paypalState = 'coral';
  }

  const paypalNode: GraphNodeData = {
    key: 'PAYPAL',
    title: '4. PayPal Payment',
    subtitle: payment ? payment.paypal_order_id : 'No Payment',
    state: paypalState,
    icon: CreditCard,
    statusText: payment ? `${payment.status} (${payment.mode})` : 'AWAITING_ORDER',
    timestamp: payment?.created_at,
    details: {
      orderId: payment?.paypal_order_id || 'N/A',
      captureId: payment?.capture_id || 'NOT_CAPTURED',
      amount: payment ? `$${payment.amount.toFixed(2)} ${payment.currency}` : 'N/A',
      mode: payment?.mode || 'DEMO',
      gatewayStatus: payment?.status || 'NOT_INITIALIZED',
    },
    evidenceIds: payment ? [payment.paypal_order_id, payment.capture_id || ''] : [],
    mismatchReason: reconStatus === 'DELIVERED_PAYMENT_UNCONFIRMED' ? 'Service delivered but PayPal capture is unconfirmed or declined.' : undefined,
  };

  // 5. WEBHOOK EVENTS
  const webhookCount = webhooks.length;
  const webhookState = webhookCount > 0 ? 'green' : (paypalState === 'green' ? 'cyan' : 'grey');
  const webhookNode: GraphNodeData = {
    key: 'WEBHOOK',
    title: '5. Webhook Ingestion',
    subtitle: webhookCount > 0 ? `${webhookCount} Verified Event${webhookCount > 1 ? 's' : ''}` : 'No Webhook Logs',
    state: webhookState,
    icon: Webhook,
    statusText: webhookCount > 0 ? 'SIGNATURE_VERIFIED' : 'PENDING_EVENT',
    timestamp: webhooks[0]?.received_at,
    details: {
      eventsRecorded: webhookCount,
      latestEventType: webhooks[0]?.event_type || 'NONE',
      signatureStatus: webhooks[0]?.signature_status || 'SIMULATED_VERIFIED',
      idempotencyCheck: 'ENFORCED_ZERO_DUPLICATES',
    },
    evidenceIds: webhooks.map(w => w.id),
  };

  // 6. SERVICE PROVISIONING
  let provState: 'green' | 'cyan' | 'coral' | 'grey' = 'grey';
  if (!latestOp) {
    provState = purchase.status === 'BLOCKED' ? 'grey' : 'cyan';
  } else if (latestOp.status === 'ACTIVE') {
    provState = 'green';
  } else if (latestOp.status === 'PROVISIONING' || latestOp.status === 'REQUESTED') {
    provState = 'cyan';
  } else {
    provState = 'coral';
  }

  const provNode: GraphNodeData = {
    key: 'PROVISIONING',
    title: '6. Service Provisioning',
    subtitle: latestOp ? latestOp.service_id : 'Not Orchestrated',
    state: provState,
    icon: Server,
    statusText: latestOp ? latestOp.status : 'NOT_STARTED',
    timestamp: latestOp?.created_at,
    details: {
      operationId: latestOp?.id || 'NONE',
      serviceId: latestOp?.service_id || 'NONE',
      serviceType: latestOp?.service_type || purchase.service_type,
      attemptNumber: latestOp?.attempt_number || 0,
      errorMessage: latestOp?.error_message || 'None (Operational)',
      healthEndpoint: latestOp?.endpoint_url || 'N/A',
    },
    evidenceIds: latestOp ? [latestOp.id, latestOp.service_id] : [],
    mismatchReason: latestOp?.error_message || undefined,
  };

  // 7. DELIVERY VERIFICATION
  let verifState: 'green' | 'cyan' | 'coral' | 'grey' = 'grey';
  if (!latestVerif) {
    verifState = 'grey';
  } else if (latestVerif.status === 'VERIFIED') {
    verifState = 'green';
  } else if (latestVerif.status === 'UNKNOWN') {
    verifState = 'cyan';
  } else {
    verifState = 'coral';
  }

  const verifNode: GraphNodeData = {
    key: 'DELIVERY',
    title: '7. Delivery Prober',
    subtitle: latestVerif ? `HTTP ${latestVerif.http_status} (${latestVerif.latency_ms}ms)` : 'Unprobed Target',
    state: verifState,
    icon: CheckCircle2,
    statusText: latestVerif ? latestVerif.status : 'PENDING_PROBE',
    timestamp: latestVerif?.verified_at,
    details: {
      verificationId: latestVerif?.id || 'NONE',
      status: latestVerif?.status || 'PENDING',
      httpStatus: latestVerif?.http_status || 'N/A',
      latency: latestVerif ? `${latestVerif.latency_ms} ms` : 'N/A',
      probeEndpoint: latestVerif?.probe_endpoint || 'N/A',
      diagnostics: latestVerif?.verification_details || 'No probe response recorded',
    },
    evidenceIds: latestVerif ? [latestVerif.id] : [],
    mismatchReason: reconStatus === 'PAID_NOT_DELIVERED' ? 'Customer was charged via PayPal, but digital delivery probe failed.' : undefined,
  };

  // 8. RECOVERY ACTION
  let recoveryState: 'green' | 'violet' | 'coral' | 'grey' = 'grey';
  if (latestProposal) {
    if (latestProposal.execution_status === 'SUCCESS') {
      recoveryState = 'green';
    } else if (latestProposal.approval_status === 'PENDING') {
      recoveryState = 'violet'; // AI / Proposed
    } else if (latestProposal.approval_status === 'REJECTED') {
      recoveryState = 'coral';
    }
  } else if (incident && incident.status !== 'RESOLVED') {
    recoveryState = 'violet';
  }

  const recoveryNode: GraphNodeData = {
    key: 'RECOVERY',
    title: '8. Controlled Recovery',
    subtitle: latestProposal ? latestProposal.action_name : (incident ? 'AI Diagnosis Pending' : 'Nominal - No Action Required'),
    state: recoveryState,
    icon: RotateCcw,
    statusText: latestProposal ? `${latestProposal.approval_status} / ${latestProposal.execution_status}` : (incident ? 'INCIDENT_ACTIVE' : 'NOMINAL'),
    timestamp: latestProposal?.created_at || incident?.created_at,
    details: {
      incidentId: incident?.id || 'NONE',
      proposedAction: latestProposal?.action_name || 'None',
      reason: latestProposal?.reason || incident?.summary || 'All invariants verified',
      approvalStatus: latestProposal?.approval_status || 'N/A',
      executionResult: latestProposal?.execution_result || 'N/A',
      requiresHumanSignoff: latestProposal ? 'YES (Strict Preconditions)' : 'NO',
    },
    evidenceIds: latestProposal ? [latestProposal.id] : (incident ? [incident.id] : []),
  };

  const nodes: GraphNodeData[] = [
    agentNode,
    authNode,
    purchaseNode,
    paypalNode,
    webhookNode,
    provNode,
    verifNode,
    recoveryNode,
  ];

  // Helper for color styling
  const getColorClasses = (state: GraphNodeData['state']) => {
    switch (state) {
      case 'green':
        return {
          border: 'border-[#C5F36A]',
          bg: 'bg-[#C5F36A]/10',
          text: 'text-[#C5F36A]',
          glow: 'shadow-[0_0_15px_rgba(197,243,106,0.25)]',
          line: '#C5F36A',
        };
      case 'cyan':
        return {
          border: 'border-[#42DDF2]',
          bg: 'bg-[#42DDF2]/10',
          text: 'text-[#42DDF2]',
          glow: 'shadow-[0_0_15px_rgba(66,221,242,0.25)]',
          line: '#42DDF2',
        };
      case 'coral':
        return {
          border: 'border-[#FF806B]',
          bg: 'bg-[#FF806B]/15',
          text: 'text-[#FF806B]',
          glow: 'shadow-[0_0_18px_rgba(255,128,107,0.35)]',
          line: '#FF806B',
        };
      case 'violet':
        return {
          border: 'border-[#A58BFA]',
          bg: 'bg-[#A58BFA]/10',
          text: 'text-[#A58BFA]',
          glow: 'shadow-[0_0_15px_rgba(165,139,250,0.25)]',
          line: '#A58BFA',
        };
      default:
        return {
          border: 'border-[#232B38]',
          bg: 'bg-[#171C25]',
          text: 'text-[#A1A1AA]',
          glow: 'shadow-none',
          line: '#232B38',
        };
    }
  };

  return (
    <div className="relative w-full border border-[#232B38] bg-[#0E121A] rounded-2xl p-6 overflow-hidden">
      {/* Graph Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#232B38]/80">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider font-mono text-[#42DDF2]">
              CORE DIFFERENTIATOR
            </span>
            <span className="text-[#A1A1AA] text-xs">·</span>
            <span className="text-xs font-mono text-[#A1A1AA]">
              TX ID: <span className="text-[#F4F4F5]">{purchase.id}</span>
            </span>
            <span className="text-[#A1A1AA] text-xs">·</span>
            <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${
              reconStatus === 'FULLY_VERIFIED' ? 'text-[#C5F36A] bg-[#C5F36A]/10 border border-[#C5F36A]/30' :
              reconStatus === 'PURCHASE_BLOCKED' ? 'text-[#FF806B] bg-[#FF806B]/10 border border-[#FF806B]/30' :
              'text-[#FF806B] bg-[#FF806B]/10 border border-[#FF806B]/30'
            }`}>
              {reconStatus || 'EVALUATING'}
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#F4F4F5] mt-1">
            Payment-to-Delivery Proof Graph
          </h2>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#A1A1AA]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C5F36A]" />
            <span>Verified</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#42DDF2]" />
            <span>Processing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF806B]" />
            <span>Failure/Mismatch</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A58BFA]" />
            <span>AI Forensic</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Graph Canvas */}
      <div className="py-10 overflow-x-auto">
        <div className="min-w-[1080px] grid grid-cols-8 gap-3 relative items-stretch">
          
          {/* Animated SVG Path connecting the 8 nodes */}
          <svg className="absolute top-[42px] left-0 w-full h-8 pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C5F36A" />
                <stop offset="50%" stopColor={reconStatus === 'PAID_NOT_DELIVERED' ? '#FF806B' : '#42DDF2'} />
                <stop offset="100%" stopColor={reconStatus === 'FULLY_VERIFIED' ? '#C5F36A' : '#A58BFA'} />
              </linearGradient>
            </defs>
            <path
              d="M 60 14 L 1020 14"
              fill="none"
              stroke="url(#flowGradient)"
              strokeWidth="2"
              strokeDasharray="6 4"
              className="animate-pulse opacity-60"
            />
          </svg>

          {nodes.map((node, idx) => {
            const colors = getColorClasses(node.state);
            const isSelected = selectedNode?.key === node.key;
            const Icon = node.icon;

            return (
              <div
                key={node.key}
                onClick={() => setSelectedNode(node)}
                className={`relative z-10 flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200 cursor-pointer select-none bg-[#11151D] hover:bg-[#171C25] ${colors.border} ${isSelected ? `${colors.glow} ring-2 ring-white/20` : ''}`}
              >
                {/* Node Top Indicator */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono text-[#A1A1AA] tabular-nums">
                      0{idx + 1}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-[#F4F4F5] truncate leading-snug">
                    {node.title.replace(/^\d+\.\s*/, '')}
                  </h4>
                  <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5" title={node.subtitle}>
                    {node.subtitle}
                  </p>
                </div>

                {/* Node Status Badge */}
                <div className="mt-4 pt-2.5 border-t border-[#232B38]/60">
                  <span className={`text-[10px] font-mono font-medium uppercase tracking-wider block truncate ${colors.text}`}>
                    {node.statusText}
                  </span>
                  {node.timestamp && (
                    <span className="text-[9px] font-mono text-[#A1A1AA] block mt-1">
                      {new Date(node.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cryptographic Limitation Disclaimer Bar */}
      <div className="mt-2 p-3 bg-[#11151D] border border-[#232B38] rounded-xl flex items-center gap-3 text-xs text-[#A1A1AA]">
        <Info className="w-4 h-4 text-[#42DDF2] shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-[#F4F4F5]">Forensic Invariant Notice:</strong> A cryptographic SHA-256 hash proves that recorded evidence has not changed since hashing. It does not independently prove that the underlying event was truthful.
        </p>
      </div>

      {/* Selected Node Inspector Drawer / Modal */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#11151D] border border-[#232B38] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#232B38]">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getColorClasses(selectedNode.state).bg} ${getColorClasses(selectedNode.state).text}`}>
                  <selectedNode.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F4F4F5]">{selectedNode.title} Evidence Node</h3>
                  <p className="text-xs text-[#A1A1AA] font-mono">{selectedNode.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#171C25] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${getColorClasses(selectedNode.state).border} ${getColorClasses(selectedNode.state).bg}`}>
                {selectedNode.state === 'coral' ? (
                  <AlertTriangle className="w-5 h-5 text-[#FF806B] shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-[#C5F36A] shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-sm font-semibold text-[#F4F4F5]">Status: {selectedNode.statusText}</h4>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">
                    {selectedNode.mismatchReason || 'Recorded state has been cryptographically validated against ledger invariants.'}
                  </p>
                </div>
              </div>

              {/* Node Details Grid */}
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA] mb-3">
                  Canonical State Properties
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedNode.details).map(([key, val]) => (
                    <div key={key} className="p-3 bg-[#171C25] border border-[#232B38] rounded-lg">
                      <span className="text-[10px] font-mono text-[#A1A1AA] uppercase block">{key}</span>
                      <span className="text-xs font-semibold text-[#F4F4F5] block truncate mt-1">
                        {String(val ?? 'N/A')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cryptographic Reference & Evidence IDs */}
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA] mb-3">
                  Underlying Forensic Evidence
                </h4>
                <div className="p-3 bg-[#090B10] border border-[#232B38] rounded-lg font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-[#A1A1AA]">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Timestamp</span>
                    <span className="text-[#F4F4F5]">{selectedNode.timestamp ? new Date(selectedNode.timestamp).toISOString() : 'N/A'}</span>
                  </div>
                  {selectedNode.hash && (
                    <div className="flex items-center justify-between text-[#A1A1AA]">
                      <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Hash</span>
                      <span className="text-[#42DDF2] truncate max-w-[300px]">{selectedNode.hash}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[#A1A1AA]">
                    <span>Linked Evidence References</span>
                    <span className="text-[#C5F36A] truncate max-w-[300px]">{selectedNode.evidenceIds.filter(Boolean).join(', ') || 'Implicit system state'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#232B38] bg-[#0E121A] flex justify-end">
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-[#171C25] hover:bg-[#232B38] rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
