import React, { useState } from 'react';
import { Settings as SettingsIcon, RotateCcw, ShieldCheck, User, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SettingsViewProps {
  onRefreshAll: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onRefreshAll }) => {
  const [operatorName, setOperatorName] = useState('OP-NEXUS-01');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleResetDatabase = async () => {
    if (!window.confirm('Reset database to pristine hackathon demo state? This will re-seed preset scenarios 1 through 4.')) {
      return;
    }
    setIsResetting(true);
    try {
      await fetch('/api/demo/reset', { method: 'POST' });
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
      onRefreshAll();
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">System Configuration & Governance</h2>
        <p className="text-xs text-[#A1A1AA] mt-0.5">
          Platform-level settings, supervisor credentials, and hackathon ledger management
        </p>
      </div>

      {resetSuccess && (
        <div className="p-4 rounded-xl bg-[#C5F36A]/10 border border-[#C5F36A]/40 text-xs font-mono text-[#C5F36A] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Database successfully reset and re-seeded with demo scenarios 1 to 4!</span>
        </div>
      )}

      {/* Operator Credentials */}
      <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-4">
        <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-2">
          <User className="w-4 h-4 text-[#42DDF2]" />
          Current Operator Identity
        </h3>
        <p className="text-xs text-[#A1A1AA]">
          Assigned supervisor credential stamped onto all human approval signatures in the recovery log.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label className="text-[#A1A1AA] block mb-1">Operator Identifier</label>
            <input
              type="text"
              value={operatorName}
              onChange={e => setOperatorName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#171C25] border border-[#232B38] text-[#F4F4F5]"
            />
          </div>
          <div>
            <label className="text-[#A1A1AA] block mb-1">Clearance Level</label>
            <div className="px-3 py-2 rounded-xl bg-[#171C25]/50 border border-[#232B38] text-[#C5F36A]">
              AUTONOMOUS_COMMERCE_SUPERVISOR
            </div>
          </div>
        </div>
      </div>

      {/* Database Reset & Seeding */}
      <div className="p-6 rounded-2xl bg-[#11151D] border border-[#FF806B]/30 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#F4F4F5] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#FF806B]" />
              Reset & Re-Seed Hackathon Ledger
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-xl leading-relaxed">
              Resets the SQLite ledger and recreates the four benchmark scenarios: (1) Fully Verified, (2) Paid Not Delivered, (3) Delivered Unconfirmed, and (4) Authorization Violation.
            </p>
          </div>

          <button
            onClick={handleResetDatabase}
            disabled={isResetting}
            className="px-4 py-2 text-xs font-bold text-[#090B10] bg-[#FF806B] hover:bg-[#ff6d54] rounded-xl transition-colors whitespace-nowrap"
          >
            {isResetting ? 'Resetting...' : 'Reset to Benchmark Demo State'}
          </button>
        </div>
      </div>

      {/* Forensic Invariant Summary */}
      <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-3 text-xs text-[#A1A1AA] leading-relaxed">
        <h4 className="font-bold text-[#F4F4F5]">Design & Architecture Standards</h4>
        <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
          <li>Strict separation between AI forensic reasoning and deterministic financial authorization.</li>
          <li>SHA-256 cryptographic hash chains prove ledger non-tampering without fabricating digital certificates.</li>
          <li>Zero frontend exposure of PayPal or Gemini API keys.</li>
          <li>Real SQLite persistence using better-sqlite3 in Write-Ahead Logging (WAL) mode.</li>
        </ul>
      </div>
    </div>
  );
};
