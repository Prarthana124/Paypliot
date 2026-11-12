import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  CreditCard, 
  Server, 
  GitFork,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';
import { PurchaseItem, ReconciliationState } from '../types';

interface TransactionExplorerProps {
  purchases: PurchaseItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenProofGraph: (purchaseId: string) => void;
  onOpenDetails: (purchaseId: string) => void;
}

export const TransactionExplorer: React.FC<TransactionExplorerProps> = ({
  purchases,
  searchQuery,
  onSearchChange,
  onOpenProofGraph,
  onOpenDetails,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = purchases.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      p.id.toLowerCase().includes(q) ||
      (p.paypal_order_id && p.paypal_order_id.toLowerCase().includes(q)) ||
      (p.agent_id && p.agent_id.toLowerCase().includes(q)) ||
      (p.agent_name && p.agent_name.toLowerCase().includes(q)) ||
      (p.product_name && p.product_name.toLowerCase().includes(q)) ||
      (p.service_id && p.service_id.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'VERIFIED') return p.reconciliation_status === 'FULLY_VERIFIED';
    if (statusFilter === 'PAID_NOT_DELIVERED') return p.reconciliation_status === 'PAID_NOT_DELIVERED';
    if (statusFilter === 'DELIVERED_UNCONFIRMED') return p.reconciliation_status === 'DELIVERED_PAYMENT_UNCONFIRMED';
    if (statusFilter === 'BLOCKED') return p.reconciliation_status === 'PURCHASE_BLOCKED';
    if (statusFilter === 'RECOVERED') return p.status === 'RECOVERED';
    return true;
  });

  const getStatusBadge = (p: PurchaseItem) => {
    const s = p.reconciliation_status;
    if (p.status === 'RECOVERED') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#C5F36A] bg-[#C5F36A]/10 border border-[#C5F36A]/30">RECOVERED</span>;
    }
    if (s === 'FULLY_VERIFIED') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#C5F36A] bg-[#C5F36A]/10 border border-[#C5F36A]/30">FULLY_VERIFIED</span>;
    }
    if (s === 'PAID_NOT_DELIVERED') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#FF806B] bg-[#FF806B]/15 border border-[#FF806B]/40">PAID_NOT_DELIVERED</span>;
    }
    if (s === 'DELIVERED_PAYMENT_UNCONFIRMED') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#A58BFA] bg-[#A58BFA]/10 border border-[#A58BFA]/30">DELIVERED_UNCONFIRMED</span>;
    }
    if (s === 'PURCHASE_BLOCKED') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#FF806B] bg-[#FF806B]/15 border border-[#FF806B]/40">PURCHASE_BLOCKED</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#42DDF2] bg-[#42DDF2]/10 border border-[#42DDF2]/30">{s || 'PENDING'}</span>;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Transaction Explorer</h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Cryptographically linked transaction ledger with dual-phase payment and delivery reconciliation
          </p>
        </div>

        <div className="text-xs font-mono text-[#A1A1AA]">
          Showing <span className="text-[#F4F4F5] font-bold">{filtered.length}</span> of {purchases.length} transactions
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by TX ID, PayPal Order ID, Agent Name, Service ID..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#11151D] border border-[#232B38] text-xs text-[#F4F4F5] font-mono focus:border-[#42DDF2] focus:outline-hidden"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#11151D] border border-[#232B38] rounded-xl overflow-x-auto">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'VERIFIED', label: 'Verified' },
            { id: 'PAID_NOT_DELIVERED', label: 'Paid≠Delivered' },
            { id: 'DELIVERED_UNCONFIRMED', label: 'Delivered≠Paid' },
            { id: 'BLOCKED', label: 'Blocked' },
            { id: 'RECOVERED', label: 'Recovered' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#171C25] text-[#F4F4F5] border border-[#232B38] font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="border border-[#232B38] rounded-2xl bg-[#11151D] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#171C25]/80 border-b border-[#232B38] text-[#A1A1AA] font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Autonomous Agent</th>
                <th className="py-3 px-4">Product & Service</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">PayPal Order</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4">Reconciliation</th>
                <th className="py-3 px-4 text-center">Proof Graph</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232B38]/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#A1A1AA]">
                    No transactions match your search filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onOpenDetails(p.id)}
                    className="hover:bg-[#171C25]/50 transition-colors cursor-pointer group"
                  >
                    {/* TX ID */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#42DDF2]">{p.id}</span>
                      <span className="text-[10px] text-[#A1A1AA] block mt-0.5">
                        {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Agent */}
                    <td className="py-3 px-4">
                      <span className="font-sans font-medium text-[#F4F4F5] block truncate max-w-[140px]">
                        {p.agent_name}
                      </span>
                      <span className="text-[10px] text-[#A1A1AA] block">{p.agent_id}</span>
                    </td>

                    {/* Product & Merchant */}
                    <td className="py-3 px-4">
                      <span className="font-sans text-[#F4F4F5] block truncate max-w-[180px]">
                        {p.product_name}
                      </span>
                      <span className="text-[10px] text-[#A1A1AA] block truncate">
                        {p.merchant} · {p.service_type}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-bold text-[#F4F4F5] tabular-nums">
                      ${p.amount.toFixed(2)}
                      <span className="text-[10px] text-[#A1A1AA] font-normal block">{p.currency}</span>
                    </td>

                    {/* PayPal Status */}
                    <td className="py-3 px-4">
                      {p.paypal_order_id ? (
                        <div>
                          <span className="text-[#C5F36A] font-medium block truncate max-w-[130px]">
                            {p.paypal_order_id}
                          </span>
                          <span className="text-[10px] text-[#A1A1AA] block">
                            {p.payment_status} ({p.payment_mode || 'DEMO'})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#A1A1AA]">BLOCKED</span>
                      )}
                    </td>

                    {/* Delivery Status */}
                    <td className="py-3 px-4">
                      <span className={
                        p.delivery_status === 'VERIFIED' ? 'text-[#C5F36A]' :
                        p.delivery_status === 'FAILED' ? 'text-[#FF806B]' : 'text-[#A1A1AA]'
                      }>
                        {p.delivery_status || p.provisioning_status || 'NOT_STARTED'}
                      </span>
                      {p.service_id && (
                        <span className="text-[10px] text-[#A1A1AA] block truncate max-w-[110px]">
                          {p.service_id}
                        </span>
                      )}
                    </td>

                    {/* Reconciliation Badge */}
                    <td className="py-3 px-4">
                      {getStatusBadge(p)}
                    </td>

                    {/* Action Proof Graph */}
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenProofGraph(p.id)}
                        title="Open Payment-to-Delivery Proof Graph"
                        className="p-1.5 rounded-lg bg-[#171C25] hover:bg-[#42DDF2]/20 text-[#42DDF2] border border-[#232B38] hover:border-[#42DDF2]/40 transition-colors inline-flex items-center justify-center"
                      >
                        <GitFork className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
