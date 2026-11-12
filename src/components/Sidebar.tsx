import React from 'react';
import { 
  LayoutDashboard, 
  Bot, 
  ShieldCheck, 
  Layers, 
  GitFork, 
  BrainCircuit, 
  RotateCcw, 
  Lock, 
  Cable, 
  Settings,
  AlertCircle,
  CheckCheck
} from 'lucide-react';

export type NavTab = 
  | 'command_center' 
  | 'system_verification'
  | 'agent_registry' 
  | 'authorization_lab' 
  | 'transaction_explorer' 
  | 'proof_graph' 
  | 'incident_intelligence' 
  | 'recovery_center' 
  | 'evidence_vault' 
  | 'integrations' 
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  openIncidentsCount: number;
  pendingProposalsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  openIncidentsCount,
  pendingProposalsCount,
}) => {
  const navItems = [
    { key: 'command_center', label: 'Command Center', icon: LayoutDashboard },
    { key: 'system_verification', label: 'System Verification', icon: CheckCheck, isSpecial: true, badge: '52', badgeColor: 'bg-[#C5F36A] text-[#090B10]' },
    { key: 'agent_registry', label: 'Agent Registry', icon: Bot },
    { key: 'authorization_lab', label: 'Authorization Lab', icon: ShieldCheck },
    { key: 'transaction_explorer', label: 'Transaction Explorer', icon: Layers },
    { key: 'proof_graph', label: 'Proof Graph', icon: GitFork, isSpecial: true },
    { 
      key: 'incident_intelligence', 
      label: 'Incident Intelligence', 
      icon: BrainCircuit, 
      badge: openIncidentsCount > 0 ? openIncidentsCount : null,
      badgeColor: 'bg-[#FF806B]' 
    },
    { 
      key: 'recovery_center', 
      label: 'Recovery Center', 
      icon: RotateCcw, 
      badge: pendingProposalsCount > 0 ? pendingProposalsCount : null,
      badgeColor: 'bg-[#A58BFA]' 
    },
    { key: 'evidence_vault', label: 'Evidence Vault', icon: Lock },
    { key: 'integrations', label: 'Integrations', icon: Cable },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-[#232B38] bg-[#0E121A] min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4">
      {/* Primary Navigation List */}
      <div className="space-y-1.5">
        <div className="px-3 py-2 text-[10px] uppercase font-mono tracking-wider text-[#A1A1AA]/70">
          OPERATIONAL WORKSPACE
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key as NavTab)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? item.isSpecial
                    ? 'bg-[#42DDF2]/15 text-[#42DDF2] border border-[#42DDF2]/30 shadow-[0_0_12px_rgba(66,221,242,0.15)] font-semibold'
                    : 'bg-[#171C25] text-[#F4F4F5] border border-[#232B38] font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#11151D] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-colors ${
                  isActive ? (item.isSpecial ? 'text-[#42DDF2]' : 'text-[#C5F36A]') : 'text-[#A1A1AA] group-hover:text-[#F4F4F5]'
                }`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono text-white font-bold ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}

              {item.isSpecial && !item.badge && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#42DDF2]/20 text-[#42DDF2]">
                  CORE
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer System Status Banner */}
      <div className="mt-6 pt-4 border-t border-[#232B38]/80 text-xs text-[#A1A1AA]">
        <div className="p-3 rounded-xl bg-[#11151D] border border-[#232B38] space-y-1 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#A1A1AA]">System Health:</span>
            <span className="text-[#C5F36A] font-bold">NOMINAL</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#A1A1AA]">Forensic Ledger:</span>
            <span className="text-[#42DDF2]">SHA-256 WAL</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#A1A1AA]">Reconciliation:</span>
            <span className="text-[#F4F4F5]">Deterministic</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
