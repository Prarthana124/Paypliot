import React from 'react';
import { 
  Search, 
  Plus, 
  Bell, 
  ShieldCheck, 
  Radio, 
  User, 
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  onOpenNewTransaction: () => void;
  onRunScenario: (scenario: 1 | 2 | 3 | 4) => void;
  isDemoMode: boolean;
  incidentCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewTransaction,
  onRunScenario,
  isDemoMode,
  incidentCount,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-[#232B38] bg-[#090B10]/95 backdrop-blur-md px-6 flex items-center justify-between gap-6">
      
      {/* Zone 1: Logo & Environment Indicator */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#C5F36A] via-[#42DDF2] to-[#A58BFA] p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(66,221,242,0.3)]">
            <div className="w-full h-full bg-[#090B10] rounded-[10px] flex items-center justify-center font-bold text-[#42DDF2] text-sm">
              PP
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-[#F4F4F5] uppercase">
                PAYPILOT
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#171C25] text-[#42DDF2] border border-[#232B38]">
                NEXUS
              </span>
            </div>
          </div>
        </div>

        {/* Live Mode Tag */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#11151D] border border-[#232B38] text-xs font-mono">
          <span className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-[#FF806B]' : 'bg-[#C5F36A] animate-pulse'}`} />
          <span className="text-[#A1A1AA]">ENV:</span>
          <span className={isDemoMode ? 'text-[#FF806B] font-semibold' : 'text-[#C5F36A] font-semibold'}>
            {isDemoMode ? 'DEMO GATEWAY' : 'PAYPAL SANDBOX'}
          </span>
        </div>
      </div>

      {/* Zone 2: Search Input */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search TX ID, PayPal Order ID, Agent ID, Service..."
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-[#11151D] border border-[#232B38] text-xs text-[#F4F4F5] placeholder-[#A1A1AA]/60 focus:outline-hidden focus:border-[#42DDF2] focus:ring-1 focus:ring-[#42DDF2] transition-all font-mono"
          />
        </div>
      </div>

      {/* Zone 3: Quick Actions & Operator Status */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Quick Demo Scenario Trigger */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 bg-[#11151D] border border-[#232B38] rounded-xl text-xs font-mono">
          <span className="px-2 text-[11px] text-[#A1A1AA]">DEMO SCENARIOS:</span>
          <button
            onClick={() => onRunScenario(1)}
            title="Scenario 1: Verified Transaction"
            className="px-2 py-1 rounded-md text-[#C5F36A] hover:bg-[#171C25] transition-colors"
          >
            #1 Valid
          </button>
          <button
            onClick={() => onRunScenario(2)}
            title="Scenario 2: Paid Not Delivered"
            className="px-2 py-1 rounded-md text-[#FF806B] hover:bg-[#171C25] transition-colors"
          >
            #2 Paid≠Delivered
          </button>
          <button
            onClick={() => onRunScenario(3)}
            title="Scenario 3: Delivered Unconfirmed"
            className="px-2 py-1 rounded-md text-[#A58BFA] hover:bg-[#171C25] transition-colors"
          >
            #3 Del≠Paid
          </button>
          <button
            onClick={() => onRunScenario(4)}
            title="Scenario 4: Authorization Blocked"
            className="px-2 py-1 rounded-md text-[#FF806B] hover:bg-[#171C25] transition-colors"
          >
            #4 AuthBlock
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onOpenNewTransaction}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#090B10] bg-[#C5F36A] hover:bg-[#b0df57] rounded-xl transition-all shadow-[0_0_15px_rgba(197,243,106,0.3)] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Transaction</span>
        </button>

        {/* Notifications & Operator Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#232B38]">
          <div className="relative p-2 rounded-xl bg-[#11151D] border border-[#232B38] text-[#A1A1AA]">
            <Bell className="w-4 h-4" />
            {incidentCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF806B] text-[9px] font-mono text-white flex items-center justify-center font-bold">
                {incidentCount}
              </span>
            )}
          </div>

          <div className="hidden xl:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#11151D] border border-[#232B38]">
            <div className="w-6 h-6 rounded-full bg-[#42DDF2]/20 text-[#42DDF2] flex items-center justify-center text-xs font-bold font-mono">
              OP
            </div>
            <div className="text-left text-xs font-mono">
              <span className="text-[#F4F4F5] block font-semibold leading-none">OP-NEXUS-01</span>
              <span className="text-[10px] text-[#A1A1AA] leading-none">SUPERVISOR</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
