import React, { useState } from 'react';
import { Bot, Shield, Plus, CheckCircle2, XCircle, Clock, DollarSign, Layers, ChevronRight, X } from 'lucide-react';
import { Agent, PurchaseItem } from '../types';

interface AgentRegistryProps {
  agents: Agent[];
  purchases: PurchaseItem[];
  onRefresh: () => void;
  onOpenProofGraph: (id: string) => void;
}

export const AgentRegistry: React.FC<AgentRegistryProps> = ({
  agents,
  purchases,
  onRefresh,
  onOpenProofGraph,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(agents[0] || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    description: '',
    categories: 'Cloud Services, Monitoring',
    max_amount: '75',
    currency: 'USD',
    allowed_merchants: 'CloudPulse Inc, Nexus Compute',
    auth_reference: `AUTH-POLICY-CUSTOM-${Date.now()}`,
  });
  const [loading, setLoading] = useState(false);

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await fetch(`/api/agents/${agent.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          categories: formData.categories.split(',').map(s => s.trim()),
          allowed_merchants: formData.allowed_merchants.split(',').map(s => s.trim()),
          max_amount: parseFloat(formData.max_amount),
        }),
      });
      setShowCreateModal(false);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const agentPurchases = purchases.filter(p => p.agent_id === selectedAgent?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Autonomous Agent Registry</h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Cryptographic governance policies, hard budget limits, and merchant allowlists for purchasing subagents
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#090B10] bg-[#C5F36A] hover:bg-[#b0df57] rounded-xl transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register Demo Agent</span>
        </button>
      </div>

      {/* Agents Grid & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Agent Cards (1 Col) */}
        <div className="space-y-3">
          <div className="text-xs font-mono text-[#A1A1AA] uppercase tracking-wider px-1">
            Registered Agents ({agents.length})
          </div>

          {agents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id;
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-4 rounded-xl border transition-all cursor-pointer bg-[#11151D] hover:bg-[#171C25] ${
                  isSelected ? 'border-[#42DDF2] shadow-[0_0_15px_rgba(66,221,242,0.15)] ring-1 ring-[#42DDF2]' : 'border-[#232B38]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[#171C25] text-[#42DDF2]">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F4F4F5]">{agent.name}</h4>
                      <span className="text-[10px] font-mono text-[#A1A1AA]">{agent.id}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    agent.status === 'ACTIVE' ? 'text-[#C5F36A] bg-[#C5F36A]/10' : 'text-[#FF806B] bg-[#FF806B]/10'
                  }`}>
                    {agent.status}
                  </span>
                </div>

                <p className="text-xs text-[#A1A1AA] mt-2.5 line-clamp-2">{agent.description}</p>

                <div className="mt-3 pt-3 border-t border-[#232B38] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#A1A1AA]">Cap:</span>
                  <span className="text-[#C5F36A] font-bold">${agent.max_amount.toFixed(2)} {agent.currency}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Agent Deep Inspector (2 Cols) */}
        {selectedAgent ? (
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#232B38]">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-[#42DDF2]/10 text-[#42DDF2] border border-[#42DDF2]/30">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#F4F4F5]">{selectedAgent.name}</h3>
                    <p className="text-xs text-[#A1A1AA] font-mono">{selectedAgent.purpose}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(selectedAgent)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      selectedAgent.status === 'ACTIVE'
                        ? 'border-[#FF806B]/30 bg-[#FF806B]/10 text-[#FF806B] hover:bg-[#FF806B]/20'
                        : 'border-[#C5F36A]/30 bg-[#C5F36A]/10 text-[#C5F36A] hover:bg-[#C5F36A]/20'
                    }`}
                  >
                    {selectedAgent.status === 'ACTIVE' ? 'Disable Agent' : 'Activate Agent'}
                  </button>
                </div>
              </div>

              {/* Policy Invariants Grid */}
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA] mb-3">
                  Deterministic Spending Invariants
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-[#171C25] border border-[#232B38] rounded-xl">
                    <span className="text-[10px] font-mono text-[#A1A1AA] uppercase block">Per-Transaction Limit</span>
                    <span className="text-base font-bold font-mono text-[#C5F36A] mt-1 block">
                      ${selectedAgent.max_amount.toFixed(2)} {selectedAgent.currency}
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#171C25] border border-[#232B38] rounded-xl">
                    <span className="text-[10px] font-mono text-[#A1A1AA] uppercase block">Authorization Policy Reference</span>
                    <span className="text-xs font-mono text-[#42DDF2] mt-1 block truncate">
                      {selectedAgent.auth_reference}
                    </span>
                  </div>

                  <div className="p-3.5 bg-[#171C25] border border-[#232B38] rounded-xl sm:col-span-2">
                    <span className="text-[10px] font-mono text-[#A1A1AA] uppercase block mb-1">Approved Categories</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgent.categories.map((c, i) => (
                        <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-[#11151D] text-[#F4F4F5] border border-[#232B38]">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#171C25] border border-[#232B38] rounded-xl sm:col-span-2">
                    <span className="text-[10px] font-mono text-[#A1A1AA] uppercase block mb-1">Approved Merchants</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgent.allowed_merchants.map((m, i) => (
                        <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-[#11151D] text-[#C5F36A] border border-[#232B38]">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase History for this Agent */}
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA] mb-3">
                  Historical Transactions ({agentPurchases.length})
                </h4>

                {agentPurchases.length === 0 ? (
                  <div className="p-6 text-center border border-[#232B38] rounded-xl text-xs text-[#A1A1AA]">
                    No transactions recorded yet for this agent.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agentPurchases.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onOpenProofGraph(p.id)}
                        className="p-3 bg-[#171C25] border border-[#232B38] hover:border-[#42DDF2]/50 rounded-xl flex items-center justify-between text-xs cursor-pointer group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#F4F4F5]">{p.product_name}</span>
                            <span className="font-mono text-[#A1A1AA]">({p.id})</span>
                          </div>
                          <span className="text-[11px] font-mono text-[#A1A1AA]">
                            ${p.amount.toFixed(2)} {p.currency} · Merchant: {p.merchant}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            p.reconciliation_status === 'FULLY_VERIFIED' ? 'text-[#C5F36A] bg-[#C5F36A]/10' : 'text-[#FF806B] bg-[#FF806B]/10'
                          }`}>
                            {p.reconciliation_status || p.status}
                          </span>
                          <ChevronRight className="w-4 h-4 text-[#A1A1AA] group-hover:text-[#42DDF2] transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : null}

      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#11151D] border border-[#232B38] rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#232B38]">
              <h3 className="text-base font-bold text-[#F4F4F5]">Register New Autonomous Demo Agent</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[#A1A1AA] hover:text-[#F4F4F5]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-[#A1A1AA] block mb-1">Agent Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. TelemetryEdge Agent"
                  className="w-full px-3 py-2 rounded-lg bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
                />
              </div>

              <div>
                <label className="text-[#A1A1AA] block mb-1">Purpose / Directive</label>
                <input
                  type="text"
                  required
                  value={formData.purpose}
                  onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="e.g. Ingest logging clusters and metrics"
                  className="w-full px-3 py-2 rounded-lg bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
                />
              </div>

              <div>
                <label className="text-[#A1A1AA] block mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Operational remit and policy boundaries"
                  className="w-full px-3 py-2 rounded-lg bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#A1A1AA] block mb-1">Max Transaction Amount ($)</label>
                  <input
                    type="number"
                    required
                    value={formData.max_amount}
                    onChange={e => setFormData({ ...formData, max_amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#171C25] border border-[#232B38] text-[#F4F4F5] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[#A1A1AA] block mb-1">Currency</label>
                  <input
                    type="text"
                    disabled
                    value={formData.currency}
                    className="w-full px-3 py-2 rounded-lg bg-[#171C25]/50 border border-[#232B38] text-[#A1A1AA] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#A1A1AA] block mb-1">Allowed Merchants (comma-separated)</label>
                <input
                  type="text"
                  required
                  value={formData.allowed_merchants}
                  onChange={e => setFormData({ ...formData, allowed_merchants: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
                />
              </div>

              <div>
                <label className="text-[#A1A1AA] block mb-1">Approved Categories (comma-separated)</label>
                <input
                  type="text"
                  required
                  value={formData.categories}
                  onChange={e => setFormData({ ...formData, categories: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-[#232B38]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#171C25] text-[#A1A1AA] hover:text-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-[#C5F36A] text-[#090B10] font-semibold hover:bg-[#b0df57]"
                >
                  {loading ? 'Registering...' : 'Register Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
