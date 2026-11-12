import React, { useState } from 'react';
import { X, Play, Bot, DollarSign, Server, ShieldCheck, Sparkles } from 'lucide-react';
import { Agent } from '../types';

interface NewTransactionModalProps {
  agents: Agent[];
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated: (purchaseId: string) => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  agents,
  isOpen,
  onClose,
  onTransactionCreated,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || 'agt_cloud_deploy');
  const [productName, setProductName] = useState('High-Bandwidth Edge Proxy Node');
  const [serviceType, setServiceType] = useState('Cloud Monitoring Service');
  const [merchant, setMerchant] = useState('CloudPulse Inc');
  const [amount, setAmount] = useState('35');
  const [simulateOutcome, setSimulateOutcome] = useState<'SUCCESS' | 'FAILURE' | 'TIMEOUT'>('SUCCESS');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const currentAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          productName,
          serviceType,
          merchant,
          amount: parseFloat(amount),
          currency: 'USD',
          simulateOutcome,
        }),
      });
      const data = await res.json();
      if (data.purchaseId) {
        onTransactionCreated(data.purchaseId);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create purchase:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-[#11151D] border border-[#232B38] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232B38] bg-[#0E121A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#C5F36A]/10 text-[#C5F36A]">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F4F4F5]">Simulate Autonomous Purchase</h3>
              <p className="text-[11px] text-[#A1A1AA] font-mono">Triggers intent, PayPal capture, and service provisioning</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1.5 rounded-lg hover:bg-[#171C25]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Agent Selection */}
          <div>
            <label className="text-[#A1A1AA] block mb-1">Purchasing Agent</label>
            <select
              value={selectedAgentId}
              onChange={e => {
                setSelectedAgentId(e.target.value);
                const ag = agents.find(a => a.id === e.target.value);
                if (ag && ag.allowed_merchants[0]) setMerchant(ag.allowed_merchants[0]);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5] font-mono focus:border-[#42DDF2] focus:outline-hidden"
            >
              {agents.map(ag => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} (Budget limit: ${ag.max_amount} {ag.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Product Name */}
          <div>
            <label className="text-[#A1A1AA] block mb-1">Digital Service Product Name</label>
            <input
              type="text"
              required
              value={productName}
              onChange={e => setProductName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
            />
          </div>

          {/* Service Type & Merchant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#A1A1AA] block mb-1">Service Type</label>
              <select
                value={serviceType}
                onChange={e => setServiceType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
              >
                <option value="Cloud Monitoring Service">Cloud Monitoring</option>
                <option value="Storage Service">Storage (NVMe/S3)</option>
                <option value="Compute Service">Compute Slices</option>
                <option value="Software Subscription">Developer Tools</option>
              </select>
            </div>
            <div>
              <label className="text-[#A1A1AA] block mb-1">Merchant</label>
              <input
                type="text"
                required
                value={merchant}
                onChange={e => setMerchant(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
              />
            </div>
          </div>

          {/* Amount & Limit Warning */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#A1A1AA] block mb-1">Transaction Amount ($)</label>
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
              <label className="text-[#A1A1AA] block mb-1">Policy Limit</label>
              <div className="px-3 py-2 rounded-xl bg-[#171C25]/60 border border-[#232B38] text-[#C5F36A] font-mono">
                ${currentAgent?.max_amount?.toFixed(2)} USD
              </div>
            </div>
          </div>

          {/* Provisioning Simulation Outcome Choice */}
          <div>
            <label className="text-[#A1A1AA] block mb-1.5">Simulate Digital Provisioning Outcome</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSimulateOutcome('SUCCESS')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  simulateOutcome === 'SUCCESS'
                    ? 'border-[#C5F36A] bg-[#C5F36A]/10 text-[#C5F36A] font-semibold'
                    : 'border-[#232B38] bg-[#171C25] text-[#A1A1AA]'
                }`}
              >
                <span className="block font-bold">Successful</span>
                <span className="text-[10px] block opacity-80">HTTP 200 Probe</span>
              </button>

              <button
                type="button"
                onClick={() => setSimulateOutcome('FAILURE')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  simulateOutcome === 'FAILURE'
                    ? 'border-[#FF806B] bg-[#FF806B]/15 text-[#FF806B] font-semibold'
                    : 'border-[#232B38] bg-[#171C25] text-[#A1A1AA]'
                }`}
              >
                <span className="block font-bold">Quota Failure</span>
                <span className="text-[10px] block opacity-80">HTTP 503 Mismatch</span>
              </button>

              <button
                type="button"
                onClick={() => setSimulateOutcome('TIMEOUT')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  simulateOutcome === 'TIMEOUT'
                    ? 'border-[#42DDF2] bg-[#42DDF2]/10 text-[#42DDF2] font-semibold'
                    : 'border-[#232B38] bg-[#171C25] text-[#A1A1AA]'
                }`}
              >
                <span className="block font-bold">Timeout</span>
                <span className="text-[10px] block opacity-80">HTTP 504 Uncertain</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#232B38]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#171C25] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-[#C5F36A] hover:bg-[#b0df57] text-[#090B10] font-bold transition-all shadow-[0_0_12px_rgba(197,243,106,0.3)] flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{loading ? 'Processing Flow...' : 'Launch Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
