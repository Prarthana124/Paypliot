import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Play, CheckCircle2, XCircle, Hash, Info, Lock, ArrowRight } from 'lucide-react';
import { Agent, Authorization } from '../types';

interface AuthorizationLabProps {
  agents: Agent[];
  authorizations: Authorization[];
  onRefresh: () => void;
}

export const AuthorizationLab: React.FC<AuthorizationLabProps> = ({
  agents,
  authorizations,
  onRefresh,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || '');
  const [productName, setProductName] = useState('High-Bandwidth Network Slice');
  const [category, setCategory] = useState('Cloud Services');
  const [merchant, setMerchant] = useState('Nexus Compute');
  const [amount, setAmount] = useState('40');
  const [purpose, setPurpose] = useState('Autonomous latency test pod');

  const [testResult, setTestResult] = useState<any | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  const handleTestAuthorization = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvaluating(true);
    try {
      const res = await fetch('/api/authorizations/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          productName,
          category,
          merchant,
          amount: parseFloat(amount),
          purpose,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      onRefresh();
    } catch (err: any) {
      setTestResult({ allowed: false, rejectionReason: err.message, status: 'BLOCKED' });
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Authorization Lab & Policy Simulator</h2>
        <p className="text-xs text-[#A1A1AA] mt-0.5">
          Deterministic pre-transaction gatekeeping. Evaluates intended purchases against registered agent policies before payment initiation.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-xl bg-[#11151D] border border-[#42DDF2]/30 flex items-start gap-3">
        <Lock className="w-5 h-5 text-[#42DDF2] shrink-0 mt-0.5" />
        <div className="text-xs">
          <h4 className="font-semibold text-[#F4F4F5]">Deterministic Rule Engine Strictness</h4>
          <p className="text-[#A1A1AA] mt-0.5 leading-relaxed">
            Unlike LLMs which can hallucinate permissions or be jailbroken via prompt injection, PAYPILOT’s Authorization Engine uses strictly deterministic criteria: cryptographic agent identity, budget thresholds, merchant allowlists, and single-use SHA-256 tokens.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Interactive Policy Test Form */}
        <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-4">
          <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C5F36A]" />
            Simulate Intended Purchase Request
          </h3>

          <form onSubmit={handleTestAuthorization} className="space-y-4 text-xs">
            {/* Agent Selector */}
            <div>
              <label className="text-[#A1A1AA] block mb-1">Target Agent</label>
              <select
                value={selectedAgentId}
                onChange={e => {
                  setSelectedAgentId(e.target.value);
                  const ag = agents.find(a => a.id === e.target.value);
                  if (ag) {
                    if (ag.allowed_merchants[0]) setMerchant(ag.allowed_merchants[0]);
                    if (ag.categories[0]) setCategory(ag.categories[0]);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5] font-mono focus:border-[#42DDF2] focus:outline-hidden"
              >
                {agents.map(ag => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} (Cap: ${ag.max_amount} {ag.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Product Name */}
            <div>
              <label className="text-[#A1A1AA] block mb-1">Intended Product / Service</label>
              <input
                type="text"
                required
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
              />
            </div>

            {/* Category & Merchant */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#A1A1AA] block mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
                />
              </div>
              <div>
                <label className="text-[#A1A1AA] block mb-1">Target Merchant</label>
                <input
                  type="text"
                  required
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
                />
              </div>
            </div>

            {/* Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#A1A1AA] block mb-1">Purchase Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5] font-mono"
                />
              </div>
              <div>
                <label className="text-[#A1A1AA] block mb-1">Agent Max Threshold</label>
                <div className="px-3 py-2 rounded-xl bg-[#171C25]/60 border border-[#232B38] text-[#C5F36A] font-mono">
                  ${selectedAgent?.max_amount?.toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="text-[#A1A1AA] block mb-1">Operational Purpose</label>
              <input
                type="text"
                required
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
              />
            </div>

            {/* Quick Test Presets */}
            <div className="pt-2">
              <span className="text-[10px] font-mono text-[#A1A1AA] block mb-1.5">TEST SHORTCUTS:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAmount('25');
                    if (selectedAgent?.allowed_merchants[0]) setMerchant(selectedAgent.allowed_merchants[0]);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#171C25] text-[#C5F36A] border border-[#232B38] hover:border-[#C5F36A]"
                >
                  Within Policy ($25)
                </button>
                <button
                  type="button"
                  onClick={() => setAmount((selectedAgent.max_amount + 50).toString())}
                  className="px-2.5 py-1 rounded-md bg-[#171C25] text-[#FF806B] border border-[#232B38] hover:border-[#FF806B]"
                >
                  Exceed Budget Limit (+ $50)
                </button>
                <button
                  type="button"
                  onClick={() => setMerchant('Untrusted Rogue Store Inc')}
                  className="px-2.5 py-1 rounded-md bg-[#171C25] text-[#FF806B] border border-[#232B38] hover:border-[#FF806B]"
                >
                  Unauthorized Merchant
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={evaluating}
              className="w-full py-2.5 rounded-xl bg-[#C5F36A] hover:bg-[#b0df57] text-[#090B10] font-bold text-xs flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{evaluating ? 'Evaluating Invariants...' : 'Evaluate Against Policy Invariants'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Invariant Rule Checks & Evaluation Result */}
        <div className="space-y-6">
          {/* Live Check Feedback */}
          <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-4">
            <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center justify-between">
              <span>Evaluation Verdict</span>
              {testResult && (
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                  testResult.allowed ? 'text-[#C5F36A] bg-[#C5F36A]/10 border border-[#C5F36A]/30' : 'text-[#FF806B] bg-[#FF806B]/10 border border-[#FF806B]/30'
                }`}>
                  {testResult.allowed ? 'PERMITTED' : 'BLOCKED'}
                </span>
              )}
            </h3>

            {!testResult ? (
              <div className="p-8 text-center border border-[#232B38] rounded-xl text-xs text-[#A1A1AA]">
                Run a simulation to view deterministic invariant checks and generated cryptographic tokens.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {testResult.allowed ? (
                  <div className="p-4 rounded-xl bg-[#C5F36A]/10 border border-[#C5F36A]/30 space-y-2">
                    <div className="flex items-center gap-2 text-[#C5F36A] font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Authorization Token Issued</span>
                    </div>
                    <div className="font-mono text-[11px] text-[#A1A1AA] space-y-1">
                      <div>Auth ID: <span className="text-[#F4F4F5]">{testResult.authorizationId}</span></div>
                      <div>Status: <span className="text-[#C5F36A]">{testResult.status}</span></div>
                      <div>Expires: <span className="text-[#F4F4F5]">{new Date(testResult.expiresAt).toLocaleTimeString()}</span></div>
                      <div className="truncate">Hash: <span className="text-[#42DDF2]">{testResult.hash}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#FF806B]/15 border border-[#FF806B]/40 space-y-2">
                    <div className="flex items-center gap-2 text-[#FF806B] font-bold">
                      <XCircle className="w-4 h-4" />
                      <span>Purchase Request Blocked</span>
                    </div>
                    <p className="text-xs text-[#F4F4F5] font-mono leading-relaxed">
                      {testResult.rejectionReason}
                    </p>
                  </div>
                )}

                {/* 5 Invariant Steps Table */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-mono text-[#A1A1AA] uppercase">Enforced Invariants</span>
                  
                  <div className="p-2.5 rounded-lg bg-[#171C25] border border-[#232B38] flex items-center justify-between font-mono">
                    <span className="text-[#A1A1AA]">1. Agent Status Active</span>
                    <span className={selectedAgent.status === 'ACTIVE' ? 'text-[#C5F36A]' : 'text-[#FF806B]'}>
                      {selectedAgent.status === 'ACTIVE' ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#171C25] border border-[#232B38] flex items-center justify-between font-mono">
                    <span className="text-[#A1A1AA]">2. Amount &lt;= ${selectedAgent.max_amount}</span>
                    <span className={parseFloat(amount) <= selectedAgent.max_amount ? 'text-[#C5F36A]' : 'text-[#FF806B]'}>
                      {parseFloat(amount) <= selectedAgent.max_amount ? 'PASSED' : 'EXCEEDED'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#171C25] border border-[#232B38] flex items-center justify-between font-mono">
                    <span className="text-[#A1A1AA]">3. Merchant Whitelist Match</span>
                    <span className={selectedAgent.allowed_merchants.some(m => m.toLowerCase().includes(merchant.toLowerCase())) ? 'text-[#C5F36A]' : 'text-[#FF806B]'}>
                      {selectedAgent.allowed_merchants.some(m => m.toLowerCase().includes(merchant.toLowerCase())) ? 'MATCHED' : 'UNAUTHORIZED'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#171C25] border border-[#232B38] flex items-center justify-between font-mono">
                    <span className="text-[#A1A1AA]">4. Category Policy Match</span>
                    <span className={selectedAgent.categories.some(c => c.toLowerCase().includes(category.toLowerCase())) ? 'text-[#C5F36A]' : 'text-[#FF806B]'}>
                      {selectedAgent.categories.some(c => c.toLowerCase().includes(category.toLowerCase())) ? 'MATCHED' : 'UNAUTHORIZED'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#171C25] border border-[#232B38] flex items-center justify-between font-mono">
                    <span className="text-[#A1A1AA]">5. SHA-256 State Hashing</span>
                    <span className="text-[#C5F36A]">DETERMINISTIC</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Recent Authorizations in Ledger */}
          <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-3">
            <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA]">
              Stored Authorizations ({authorizations.length})
            </h4>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {authorizations.slice(0, 5).map(auth => (
                <div key={auth.id} className="p-2.5 bg-[#171C25] border border-[#232B38] rounded-lg text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#42DDF2]">{auth.id}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                      auth.status === 'ACTIVE' ? 'text-[#C5F36A] bg-[#C5F36A]/10' : 'text-[#FF806B] bg-[#FF806B]/10'
                    }`}>
                      {auth.status}
                    </span>
                  </div>
                  <div className="text-[#A1A1AA] flex justify-between">
                    <span>{auth.intended_product}</span>
                    <span className="text-[#F4F4F5]">${auth.max_amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
