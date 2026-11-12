import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Bot, 
  RotateCcw, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';
import { PurchaseItem, Incident, RecoveryProposal } from '../types';
import { HeroFlow } from './HeroFlow';

interface CommandCenterProps {
  purchases: PurchaseItem[];
  incidents: Incident[];
  recoveryProposals: RecoveryProposal[];
  onSelectPurchase: (id: string) => void;
  onOpenProofGraph: (id: string) => void;
  onRunDemoScenario: (num: 1 | 2 | 3 | 4) => void;
  onNavigateToTab: (tab: any) => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  purchases,
  incidents,
  recoveryProposals,
  onSelectPurchase,
  onOpenProofGraph,
  onRunDemoScenario,
  onNavigateToTab,
}) => {
  const [timeFilter, setTimeFilter] = useState<'today' | '7d' | '30d' | 'all'>('all');

  // Compute metrics from real database rows
  const totalPurchases = purchases.length;
  const successfulPayments = purchases.filter(p => p.payment_status === 'COMPLETED').length;
  const verifiedDeliveries = purchases.filter(p => p.delivery_status === 'VERIFIED').length;
  const mismatches = purchases.filter(p => 
    p.reconciliation_status === 'PAID_NOT_DELIVERED' || 
    p.reconciliation_status === 'DELIVERED_PAYMENT_UNCONFIRMED' ||
    p.reconciliation_status === 'PURCHASE_BLOCKED'
  ).length;
  const pendingTransactions = purchases.filter(p => p.status === 'PENDING' || p.reconciliation_status === 'AWAITING_PAYMENT').length;
  const failedProvisioning = purchases.filter(p => p.provisioning_status === 'FAILED' || p.provisioning_status === 'TIMEOUT').length;
  
  const totalValue = purchases.reduce((acc, p) => acc + (p.amount || 0), 0);
  const executedRecoveries = recoveryProposals.filter(r => r.execution_status === 'SUCCESS').length;
  const recoverySuccessRate = recoveryProposals.length > 0
    ? Math.round((executedRecoveries / recoveryProposals.length) * 100)
    : 100;

  // Active transaction for Hero visualization
  const activePurchase = purchases[0] || null;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Signature Hero Visualization */}
      <HeroFlow
        activePurchase={activePurchase}
        onOpenProofGraph={onOpenProofGraph}
        onRunDemoScenario={onRunDemoScenario}
      />

      {/* 2. Filter Bar & Metrics Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Mission Control Metrics</h2>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Real-time ledger audit across autonomous agent commerce channels</p>
        </div>

        {/* Time Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#11151D] border border-[#232B38] rounded-xl self-start sm:self-auto">
          {(['today', '7d', '30d', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setTimeFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                timeFilter === tab
                  ? 'bg-[#171C25] text-[#F4F4F5] shadow-xs border border-[#232B38]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              {tab === 'today' ? 'Today' : tab === '7d' ? 'Last 7 Days' : tab === '30d' ? 'Last 30 Days' : 'All Ledger'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. High-Density Metric KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#232B38] relative overflow-hidden">
          <div className="flex items-center justify-between text-[#A1A1AA] text-xs font-mono">
            <span>TOTAL AGENT PURCHASES</span>
            <Bot className="w-4 h-4 text-[#42DDF2]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F4F4F5] mt-2 tabular-nums">
            {totalPurchases}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1 font-mono">
            Autonomous transactions
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#232B38] relative overflow-hidden">
          <div className="flex items-center justify-between text-[#A1A1AA] text-xs font-mono">
            <span>VERIFIED DELIVERIES</span>
            <CheckCircle2 className="w-4 h-4 text-[#C5F36A]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#C5F36A] mt-2 tabular-nums">
            {verifiedDeliveries}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1 font-mono">
            Probed HTTP 200 OK
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#FF806B]/30 bg-[#FF806B]/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#FF806B] text-xs font-mono">
            <span>PAYMENT / DELIVERY MISMATCH</span>
            <ShieldAlert className="w-4 h-4 text-[#FF806B]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FF806B] mt-2 tabular-nums">
            {mismatches}
          </div>
          <div className="text-[11px] text-[#FF806B]/80 mt-1 font-mono">
            Discrepancies flagged
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#232B38] relative overflow-hidden">
          <div className="flex items-center justify-between text-[#A1A1AA] text-xs font-mono">
            <span>TOTAL VALUE ORCHESTRATED</span>
            <DollarSign className="w-4 h-4 text-[#A58BFA]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F4F4F5] mt-2 tabular-nums">
            ${totalValue.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1 font-mono">
            USD processed in demo
          </div>
        </div>

        {/* KPI 5 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#232B38]">
          <div className="text-[#A1A1AA] text-xs font-mono">PAYPAL CAPTURES</div>
          <div className="text-xl font-bold font-mono text-[#F4F4F5] mt-1.5 tabular-nums">
            {successfulPayments} <span className="text-xs text-[#A1A1AA] font-normal font-sans">confirmed</span>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#232B38]">
          <div className="text-[#A1A1AA] text-xs font-mono">PROVISIONING FAILURES</div>
          <div className="text-xl font-bold font-mono text-[#FF806B] mt-1.5 tabular-nums">
            {failedProvisioning} <span className="text-xs text-[#A1A1AA] font-normal font-sans">timeout/quota</span>
          </div>
        </div>

        {/* KPI 7 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#232B38]">
          <div className="text-[#A1A1AA] text-xs font-mono">RECOVERY SUCCESS RATE</div>
          <div className="text-xl font-bold font-mono text-[#C5F36A] mt-1.5 tabular-nums">
            {recoverySuccessRate}% <span className="text-xs text-[#A1A1AA] font-normal font-sans">executed</span>
          </div>
        </div>

        {/* KPI 8 */}
        <div className="p-4 rounded-2xl bg-[#11151D] border border-[#232B38]">
          <div className="text-[#A1A1AA] text-xs font-mono">PENDING INVARIANTS</div>
          <div className="text-xl font-bold font-mono text-[#42DDF2] mt-1.5 tabular-nums">
            {pendingTransactions} <span className="text-xs text-[#A1A1AA] font-normal font-sans">in flight</span>
          </div>
        </div>
      </div>

      {/* 4. Two-Column Analytics Split: Activity Curve & Discrepancy Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel A: Autonomous Activity Flow */}
        <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#42DDF2]" />
                Transaction Activity Curve
              </h3>
              <span className="text-[11px] font-mono text-[#42DDF2]">HOURLY STREAM</span>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Synchronous audit throughput comparing payment authorizations with infrastructure provisioning requests.
            </p>
          </div>

          {/* SVG Activity Curve */}
          <div className="h-44 w-full mt-6 flex items-end">
            <svg viewBox="0 0 400 120" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#42DDF2" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#42DDF2" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="400" y2="30" stroke="#232B38" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="400" y2="70" stroke="#232B38" strokeDasharray="3 3" />
              <line x1="0" y1="110" x2="400" y2="110" stroke="#232B38" />

              {/* Area */}
              <polygon
                points="0,110 0,80 40,75 80,45 120,60 160,25 200,40 240,15 280,50 320,30 360,10 400,20 400,110"
                fill="url(#areaGradient)"
              />
              {/* Line */}
              <polyline
                fill="none"
                stroke="#42DDF2"
                strokeWidth="2.5"
                points="0,80 40,75 80,45 120,60 160,25 200,40 240,15 280,50 320,30 360,10 400,20"
              />
              {/* Highlight Points */}
              <circle cx="160" cy="25" r="4" fill="#C5F36A" />
              <circle cx="280" cy="50" r="4" fill="#FF806B" />
              <circle cx="360" cy="10" r="4" fill="#42DDF2" />
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#A1A1AA] pt-3 border-t border-[#232B38] mt-4">
            <span>T-06h</span>
            <span>T-04h</span>
            <span>T-02h</span>
            <span className="text-[#42DDF2]">Now (Real-Time)</span>
          </div>
        </div>

        {/* Panel B: Payment vs Delivery Invariant Status */}
        <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#FF806B]" />
                Payment vs Delivery Status Distribution
              </h3>
              <span className="text-[11px] font-mono text-[#A1A1AA]">RECONCILIATION BREAKDOWN</span>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Distribution of transactions categorised by dual-phase verification invariant integrity.
            </p>
          </div>

          <div className="space-y-3.5 my-4">
            {/* Status Bar 1 */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#C5F36A]">FULLY_VERIFIED (Payment + Delivery OK)</span>
                <span className="text-[#F4F4F5]">{verifiedDeliveries}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#171C25] overflow-hidden">
                <div 
                  className="h-full bg-[#C5F36A]" 
                  style={{ width: `${totalPurchases ? (verifiedDeliveries / totalPurchases) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Status Bar 2 */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#FF806B]">PAID_NOT_DELIVERED (Customer Charged, Service Missing)</span>
                <span className="text-[#FF806B]">
                  {purchases.filter(p => p.reconciliation_status === 'PAID_NOT_DELIVERED').length}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#171C25] overflow-hidden">
                <div 
                  className="h-full bg-[#FF806B]" 
                  style={{ width: `${totalPurchases ? (purchases.filter(p => p.reconciliation_status === 'PAID_NOT_DELIVERED').length / totalPurchases) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Status Bar 3 */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#A58BFA]">DELIVERED_PAYMENT_UNCONFIRMED (Merchant Risk)</span>
                <span className="text-[#A58BFA]">
                  {purchases.filter(p => p.reconciliation_status === 'DELIVERED_PAYMENT_UNCONFIRMED').length}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#171C25] overflow-hidden">
                <div 
                  className="h-full bg-[#A58BFA]" 
                  style={{ width: `${totalPurchases ? (purchases.filter(p => p.reconciliation_status === 'DELIVERED_PAYMENT_UNCONFIRMED').length / totalPurchases) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Status Bar 4 */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#FF806B]/80">PURCHASE_BLOCKED (Policy Violation)</span>
                <span className="text-[#FF806B]/80">
                  {purchases.filter(p => p.reconciliation_status === 'PURCHASE_BLOCKED').length}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#171C25] overflow-hidden">
                <div 
                  className="h-full bg-[#FF806B]/60" 
                  style={{ width: `${totalPurchases ? (purchases.filter(p => p.reconciliation_status === 'PURCHASE_BLOCKED').length / totalPurchases) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#A1A1AA] pt-3 border-t border-[#232B38] flex items-center justify-between">
            <span>Deterministic Enforcement</span>
            <span className="text-[#C5F36A]">Zero Hallucinated Approvals</span>
          </div>
        </div>

      </div>

      {/* 5. Live Incidents & Recent Agent Actions Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Incidents List (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#11151D] border border-[#232B38]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FF806B]" />
                Recent Incidents Requiring Intervention
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">Discrepancies identified by the deterministic reconciliation engine</p>
            </div>
            <button
              onClick={() => onNavigateToTab('incident_intelligence')}
              className="text-xs text-[#42DDF2] hover:underline font-mono flex items-center gap-1"
            >
              View All Intelligence <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {incidents.length === 0 ? (
            <div className="p-8 text-center border border-[#232B38] rounded-xl text-xs text-[#A1A1AA]">
              No active incidents detected. All transaction invariants nominal.
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, 3).map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => onOpenProofGraph(inc.purchase_id)}
                  className="p-4 rounded-xl bg-[#171C25] border border-[#232B38] hover:border-[#FF806B]/50 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FF806B]/15 text-[#FF806B] font-bold">
                        {inc.severity}
                      </span>
                      <span className="text-xs font-mono text-[#A1A1AA]">{inc.id}</span>
                      <span className="text-[#A1A1AA]">·</span>
                      <span className="text-xs font-semibold text-[#F4F4F5]">{inc.agent_name}</span>
                    </div>
                    <p className="text-xs text-[#F4F4F5]/90 line-clamp-1">{inc.summary}</p>
                    <div className="text-[11px] font-mono text-[#A1A1AA]">
                      Product: <span className="text-[#42DDF2]">{inc.product_name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToTab('recovery_center');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#A58BFA] bg-[#A58BFA]/10 hover:bg-[#A58BFA]/20 border border-[#A58BFA]/30 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Resolve in Recovery Center
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Recovery Actions (1 Col) */}
        <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#A58BFA]" />
                Recent Recoveries
              </h3>
              <button
                onClick={() => onNavigateToTab('recovery_center')}
                className="text-xs text-[#A58BFA] hover:underline font-mono"
              >
                Open Center
              </button>
            </div>
            <p className="text-xs text-[#A1A1AA] mb-4">
              Human-in-the-loop recovery executions and precondition validations.
            </p>

            <div className="space-y-3">
              {recoveryProposals.slice(0, 3).map((prop) => (
                <div key={prop.id} className="p-3 bg-[#171C25] border border-[#232B38] rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-[#A1A1AA]">{prop.action_type}</span>
                    <span className={`px-1.5 py-0.2 rounded font-bold ${
                      prop.approval_status === 'APPROVED' ? 'text-[#C5F36A] bg-[#C5F36A]/10' : 'text-[#A58BFA] bg-[#A58BFA]/10'
                    }`}>
                      {prop.approval_status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-[#F4F4F5]">{prop.action_name}</h4>
                  <p className="text-[11px] text-[#A1A1AA] line-clamp-1">{prop.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#232B38] text-[11px] font-mono text-[#A1A1AA] flex items-center justify-between">
            <span>Sensitive Actions Approval:</span>
            <span className="text-[#C5F36A] font-semibold">HUMAN REQUIRED</span>
          </div>
        </div>

      </div>

    </div>
  );
};
