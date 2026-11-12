import React from 'react';
import { Bot, ShieldAlert, ShieldCheck, CreditCard, Server, CheckCircle2, AlertOctagon, Sparkles } from 'lucide-react';
import { PurchaseItem } from '../types';

interface HeroFlowProps {
  activePurchase: PurchaseItem | null;
  onOpenProofGraph: (purchaseId: string) => void;
  onRunDemoScenario: (num: 1 | 2 | 3 | 4) => void;
}

export const HeroFlow: React.FC<HeroFlowProps> = ({
  activePurchase,
  onOpenProofGraph,
  onRunDemoScenario,
}) => {
  const isMismatch = activePurchase?.reconciliation_status === 'PAID_NOT_DELIVERED' || 
                     activePurchase?.reconciliation_status === 'DELIVERED_PAYMENT_UNCONFIRMED' ||
                     activePurchase?.reconciliation_status === 'PURCHASE_BLOCKED';
  
  const isRecovered = activePurchase?.status === 'RECOVERED' || activePurchase?.reconciliation_status === 'FULLY_VERIFIED';

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-[#232B38] bg-gradient-to-b from-[#11151D] via-[#0E121A] to-[#090B10] p-8 md:p-10 shadow-2xl">
      {/* Background ambient radial gradients */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#42DDF2]/5 rounded-full blur-3xl pointer-events-none" />
      <div className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
        isMismatch ? 'bg-[#FF806B]/10' : 'bg-[#C5F36A]/5'
      }`} />

      {/* Hero Header */}
      <div className="relative z-10 max-w-3xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono font-semibold tracking-widest uppercase text-[#42DDF2]">
            AUTONOMOUS COMMERCE INTELLIGENCE
          </span>
          <span className="text-[#A1A1AA] text-xs">·</span>
          <span className="text-xs font-mono text-[#A1A1AA]">NEXUS MODE</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#F4F4F5] leading-tight text-balance">
          EVERY PURCHASE HAS A STORY.
        </h1>
        <p className="text-base md:text-lg text-[#A1A1AA] mt-2 font-light">
          Trace the intent. Verify the payment. Prove the outcome.
        </p>
      </div>

      {/* Signature Animated Node Pipeline */}
      <div className="relative z-10 mt-8 pt-6 border-t border-[#232B38]/60">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Node 1: AGENT */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#C5F36A]/10 border border-[#C5F36A] flex items-center justify-center text-[#C5F36A] shadow-[0_0_20px_rgba(197,243,106,0.2)]">
              <Bot className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-[#F4F4F5] mt-2">AGENT</span>
            <span className="text-[10px] font-mono text-[#C5F36A]">INTENT DISPATCHED</span>
          </div>

          {/* Connector 1 */}
          <div className="h-0.5 w-12 md:w-24 bg-gradient-to-r from-[#C5F36A] to-[#42DDF2] relative">
            <div className="absolute inset-0 bg-white/40 animate-pulse" />
          </div>

          {/* Node 2: AUTHORIZATION */}
          <div className="flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
              activePurchase?.reconciliation_status === 'PURCHASE_BLOCKED'
                ? 'bg-[#FF806B]/15 border-[#FF806B] text-[#FF806B] shadow-[0_0_20px_rgba(255,128,107,0.3)] animate-bounce'
                : 'bg-[#C5F36A]/10 border-[#C5F36A] text-[#C5F36A]'
            }`}>
              {activePurchase?.reconciliation_status === 'PURCHASE_BLOCKED' ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
            </div>
            <span className="text-xs font-semibold text-[#F4F4F5] mt-2">AUTHORIZATION</span>
            <span className={`text-[10px] font-mono ${activePurchase?.reconciliation_status === 'PURCHASE_BLOCKED' ? 'text-[#FF806B]' : 'text-[#C5F36A]'}`}>
              {activePurchase?.reconciliation_status === 'PURCHASE_BLOCKED' ? 'POLICY VIOLATED' : 'DETERMINISTIC OK'}
            </span>
          </div>

          {/* Connector 2 */}
          <div className={`h-0.5 w-12 md:w-24 relative ${
            activePurchase?.reconciliation_status === 'PURCHASE_BLOCKED' ? 'bg-[#232B38]' : 'bg-gradient-to-r from-[#C5F36A] to-[#42DDF2]'
          }`} />

          {/* Node 3: PAYPAL */}
          <div className="flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
              activePurchase?.reconciliation_status === 'DELIVERED_PAYMENT_UNCONFIRMED'
                ? 'bg-[#FF806B]/15 border-[#FF806B] text-[#FF806B] shadow-[0_0_20px_rgba(255,128,107,0.3)] animate-pulse'
                : activePurchase?.payment_status === 'COMPLETED'
                ? 'bg-[#C5F36A]/10 border-[#C5F36A] text-[#C5F36A]'
                : 'bg-[#171C25] border-[#232B38] text-[#A1A1AA]'
            }`}>
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-[#F4F4F5] mt-2">PAYPAL</span>
            <span className={`text-[10px] font-mono ${
              activePurchase?.payment_status === 'COMPLETED' ? 'text-[#C5F36A]' : 
              activePurchase?.reconciliation_status === 'DELIVERED_PAYMENT_UNCONFIRMED' ? 'text-[#FF806B]' : 'text-[#A1A1AA]'
            }`}>
              {activePurchase?.payment_status || 'PENDING'}
            </span>
          </div>

          {/* Connector 3 */}
          <div className={`h-0.5 w-12 md:w-24 relative ${
            activePurchase?.reconciliation_status === 'PAID_NOT_DELIVERED'
              ? 'bg-[#FF806B]'
              : isRecovered
              ? 'bg-[#C5F36A]'
              : 'bg-gradient-to-r from-[#42DDF2] to-[#C5F36A]'
          }`} />

          {/* Node 4: SERVICE PROVISIONING */}
          <div className="flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
              activePurchase?.reconciliation_status === 'PAID_NOT_DELIVERED'
                ? 'bg-[#FF806B]/15 border-[#FF806B] text-[#FF806B] shadow-[0_0_20px_rgba(255,128,107,0.3)] animate-pulse'
                : activePurchase?.provisioning_status === 'ACTIVE'
                ? 'bg-[#C5F36A]/10 border-[#C5F36A] text-[#C5F36A]'
                : 'bg-[#171C25] border-[#232B38] text-[#A1A1AA]'
            }`}>
              <Server className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-[#F4F4F5] mt-2">PROVISIONING</span>
            <span className={`text-[10px] font-mono ${
              activePurchase?.reconciliation_status === 'PAID_NOT_DELIVERED' ? 'text-[#FF806B]' : 
              activePurchase?.provisioning_status === 'ACTIVE' ? 'text-[#C5F36A]' : 'text-[#A1A1AA]'
            }`}>
              {activePurchase?.provisioning_status || 'NOT_STARTED'}
            </span>
          </div>

          {/* Connector 4 */}
          <div className={`h-0.5 w-12 md:w-24 relative ${
            isRecovered ? 'bg-[#C5F36A]' : activePurchase?.reconciliation_status === 'PAID_NOT_DELIVERED' ? 'bg-[#FF806B]' : 'bg-[#232B38]'
          }`} />

          {/* Node 5: VERIFIED DELIVERY */}
          <div className="flex flex-col items-center text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
              isRecovered
                ? 'bg-[#C5F36A]/10 border-[#C5F36A] text-[#C5F36A] shadow-[0_0_20px_rgba(197,243,106,0.3)]'
                : activePurchase?.reconciliation_status === 'PAID_NOT_DELIVERED'
                ? 'bg-[#FF806B]/15 border-[#FF806B] text-[#FF806B]'
                : 'bg-[#171C25] border-[#232B38] text-[#A1A1AA]'
            }`}>
              {isRecovered ? <CheckCircle2 className="w-6 h-6" /> : <AlertOctagon className="w-6 h-6" />}
            </div>
            <span className="text-xs font-semibold text-[#F4F4F5] mt-2">VERIFIED DELIVERY</span>
            <span className={`text-[10px] font-mono ${isRecovered ? 'text-[#C5F36A]' : 'text-[#A1A1AA]'}`}>
              {isRecovered ? 'PROVEN OUTCOME' : 'UNVERIFIED'}
            </span>
          </div>

        </div>

        {/* Dynamic Status Callout in Hero */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#090B10]/70 border border-[#232B38]">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isRecovered ? 'bg-[#C5F36A]' : isMismatch ? 'bg-[#FF806B] animate-ping' : 'bg-[#42DDF2]'
            }`} />
            <div className="text-xs">
              <span className="text-[#A1A1AA]">Active Monitored Stream: </span>
              <strong className="text-[#F4F4F5]">
                {activePurchase?.product_name || 'Monitoring Starter Plan'}
              </strong>{' '}
              <span className="font-mono text-[#A1A1AA]">({activePurchase?.id || 'DEMO-STREAM'})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activePurchase && (
              <button
                onClick={() => onOpenProofGraph(activePurchase.id)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#42DDF2] bg-[#42DDF2]/10 hover:bg-[#42DDF2]/20 border border-[#42DDF2]/30 rounded-lg transition-colors whitespace-nowrap"
              >
                Inspect Full Proof Graph
              </button>
            )}

            <button
              onClick={() => onRunDemoScenario(2)}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#FF806B] bg-[#FF806B]/10 hover:bg-[#FF806B]/20 border border-[#FF806B]/30 rounded-lg transition-colors whitespace-nowrap"
            >
              Simulate Delivery Mismatch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
