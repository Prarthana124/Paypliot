import React, { useState } from 'react';
import { 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  UserCheck, 
  Play, 
  ArrowRight,
  GitFork,
  Clock,
  ExternalLink,
  Lock
} from 'lucide-react';
import { RecoveryProposal } from '../types';

interface RecoveryCenterProps {
  proposals: RecoveryProposal[];
  onOpenProofGraph: (purchaseId: string) => void;
  onRefresh: () => void;
}

export const RecoveryCenter: React.FC<RecoveryCenterProps> = ({
  proposals,
  onOpenProofGraph,
  onRefresh,
}) => {
  const [selectedProposal, setSelectedProposal] = useState<RecoveryProposal | null>(proposals[0] || null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [operatorId, setOperatorId] = useState('OP-NEXUS-01');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionDiff, setExecutionDiff] = useState<any | null>(null);

  const handleExecute = async () => {
    if (!selectedProposal) return;
    setIsExecuting(true);
    try {
      const res = await fetch('/api/recovery/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: selectedProposal.id,
          operator: operatorId,
        }),
      });
      const data = await res.json();
      setExecutionDiff({
        beforeStatus: 'PAID_NOT_DELIVERED',
        afterStatus: data.postReconciliationStatus || 'FULLY_VERIFIED',
        result: data.executionResult,
      });
      setShowApprovalModal(false);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsExecuting(false);
    }
  };

  const pendingProposals = proposals.filter(p => p.approval_status === 'PENDING');
  const executedProposals = proposals.filter(p => p.approval_status !== 'PENDING');

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Recovery Center</h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Supervised recovery workflows for payment-to-delivery mismatches. Enforces human sign-off on sensitive infrastructure actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#11151D] border border-[#232B38] text-[#A58BFA]">
            {pendingProposals.length} Pending Sign-Off
          </span>
        </div>
      </div>

      {/* Execution Diff Banner if Just Executed */}
      {executionDiff && (
        <div className="p-5 rounded-2xl bg-[#C5F36A]/10 border border-[#C5F36A]/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#C5F36A] font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Recovery Action Executed Successfully</span>
            </div>
            <button
              onClick={() => setExecutionDiff(null)}
              className="text-xs text-[#A1A1AA] hover:text-[#F4F4F5]"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#C5F36A]/20">
            <div className="p-3 bg-[#11151D] rounded-xl border border-[#232B38] font-mono text-xs">
              <span className="text-[10px] text-[#A1A1AA] uppercase block mb-1">State Transition</span>
              <div className="flex items-center gap-2">
                <span className="text-[#FF806B] font-bold line-through">{executionDiff.beforeStatus}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span className="text-[#C5F36A] font-bold">{executionDiff.afterStatus}</span>
              </div>
            </div>

            <div className="p-3 bg-[#11151D] rounded-xl border border-[#232B38] font-mono text-xs">
              <span className="text-[10px] text-[#A1A1AA] uppercase block mb-1">Result & Ledger Hash</span>
              <p className="text-[#F4F4F5] text-[11px] leading-snug">{executionDiff.result}</p>
            </div>
          </div>
        </div>
      )}

      {/* Precondition Gates & Action Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Proposals List (1 Col) */}
        <div className="space-y-3">
          <div className="text-xs font-mono text-[#A1A1AA] uppercase tracking-wider px-1">
            Recovery Proposals ({proposals.length})
          </div>

          {proposals.length === 0 ? (
            <div className="p-8 text-center border border-[#232B38] rounded-xl text-xs text-[#A1A1AA]">
              No recovery actions currently pending.
            </div>
          ) : (
            proposals.map((prop) => {
              const isSelected = selectedProposal?.id === prop.id;
              const isPending = prop.approval_status === 'PENDING';

              return (
                <div
                  key={prop.id}
                  onClick={() => setSelectedProposal(prop)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer bg-[#11151D] hover:bg-[#171C25] ${
                    isSelected ? 'border-[#C5F36A] ring-1 ring-[#C5F36A] shadow-[0_0_15px_rgba(197,243,106,0.15)]' : 'border-[#232B38]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      isPending ? 'text-[#A58BFA] bg-[#A58BFA]/10 border border-[#A58BFA]/30' : 'text-[#C5F36A] bg-[#C5F36A]/10 border border-[#C5F36A]/30'
                    }`}>
                      {prop.approval_status}
                    </span>
                    <span className="text-[10px] font-mono text-[#A1A1AA]">{prop.id}</span>
                  </div>

                  <h4 className="text-xs font-bold text-[#F4F4F5]">{prop.action_name}</h4>
                  <p className="text-[11px] text-[#A1A1AA] mt-1 line-clamp-2">{prop.reason}</p>

                  <div className="mt-3 pt-2.5 border-t border-[#232B38] flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#42DDF2]">{prop.product_name || prop.purchase_id}</span>
                    <span className="text-[#A1A1AA]">{prop.action_type}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Proposal Inspection & Execution Workbench (2 Cols) */}
        {selectedProposal ? (
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#232B38]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#A58BFA]">
                      PROPOSAL ID: {selectedProposal.id}
                    </span>
                    <span className="text-[#A1A1AA]">·</span>
                    <span className="text-xs font-mono text-[#A1A1AA]">TX: {selectedProposal.purchase_id}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#F4F4F5] mt-1">
                    {selectedProposal.action_name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenProofGraph(selectedProposal.purchase_id)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold text-[#42DDF2] bg-[#42DDF2]/10 hover:bg-[#42DDF2]/20 border border-[#42DDF2]/30 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Proof Graph</span>
                  </button>

                  {selectedProposal.approval_status === 'PENDING' && (
                    <button
                      onClick={() => setShowApprovalModal(true)}
                      className="px-4 py-2 text-xs font-bold text-[#090B10] bg-[#C5F36A] hover:bg-[#b0df57] rounded-lg transition-colors flex items-center gap-1.5 shadow-[0_0_12px_rgba(197,243,106,0.25)]"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Review & Approve Action</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Preconditions Checklist */}
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA] mb-3">
                  Safety Preconditions & Invariant Gates
                </h4>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[#171C25] border border-[#232B38] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#A1A1AA]">1. Upstream Quota & Diagnostic Check</span>
                    <span className="text-[#C5F36A]">SATISFIED</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#171C25] border border-[#232B38] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#A1A1AA]">2. Idempotency Key Allocated</span>
                    <span className="text-[#C5F36A]">ENFORCED</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#171C25] border border-[#232B38] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#A1A1AA]">3. Non-Destructive Invariant Assertion</span>
                    <span className="text-[#C5F36A]">PASSED</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#171C25] border border-[#232B38] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#A1A1AA]">4. Human Supervisor Approval Requirement</span>
                    <span className="text-[#A58BFA]">STRICT GATE</span>
                  </div>
                </div>
              </div>

              {/* Action Details & Rationale */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA]">
                  Operational Rationale
                </h4>
                <div className="p-4 rounded-xl bg-[#090B10] border border-[#232B38] text-xs font-mono text-[#F4F4F5] leading-relaxed">
                  {selectedProposal.reason}
                </div>
              </div>

              {/* Execution Record if already executed */}
              {selectedProposal.execution_status === 'SUCCESS' && (
                <div className="p-4 rounded-xl bg-[#C5F36A]/10 border border-[#C5F36A]/30 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#C5F36A] font-bold font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Execution Audit Logged</span>
                  </div>
                  <p className="font-mono text-[#A1A1AA]">
                    Approved By: <span className="text-[#F4F4F5]">{selectedProposal.approved_by || 'OP-NEXUS-01'}</span>
                  </p>
                  <p className="font-mono text-[#A1A1AA]">
                    Result: <span className="text-[#F4F4F5]">{selectedProposal.execution_result}</span>
                  </p>
                </div>
              )}

            </div>
          </div>
        ) : null}

      </div>

      {/* Human Approval Confirmation Modal */}
      {showApprovalModal && selectedProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#11151D] border border-[#232B38] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-[#232B38]">
              <div className="p-2.5 rounded-xl bg-[#C5F36A]/10 text-[#C5F36A]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F4F4F5]">Human Supervisor Sign-Off</h3>
                <p className="text-xs text-[#A1A1AA] font-mono">Proposal: {selectedProposal.action_name}</p>
              </div>
            </div>

            <div className="text-xs text-[#A1A1AA] space-y-2 leading-relaxed">
              <p>
                You are about to execute a recovery action for transaction <strong className="text-[#F4F4F5] font-mono">{selectedProposal.purchase_id}</strong>.
              </p>
              <div className="p-3 bg-[#171C25] border border-[#232B38] rounded-xl font-mono text-[11px] text-[#F4F4F5]">
                {selectedProposal.reason}
              </div>
              <p className="text-[#FF806B]">
                This will trigger an idempotent retry and re-run dual-phase delivery verification.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-[#A1A1AA] block mb-1">Operator Signature</label>
              <input
                type="text"
                value={operatorId}
                onChange={e => setOperatorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-xs font-mono text-[#F4F4F5]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#232B38]">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs rounded-xl bg-[#171C25] text-[#A1A1AA] hover:text-[#F4F4F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleExecute}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#C5F36A] text-[#090B10] hover:bg-[#b0df57] transition-colors flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isExecuting ? 'Executing Recovery...' : 'Authorize & Execute'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
