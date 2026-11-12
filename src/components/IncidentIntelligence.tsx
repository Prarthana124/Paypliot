import React, { useState } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  HelpCircle, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  RefreshCw,
  Lock,
  ArrowRight
} from 'lucide-react';
import { Incident } from '../types';

interface IncidentIntelligenceProps {
  incidents: Incident[];
  onOpenProofGraph: (purchaseId: string) => void;
  onNavigateToRecovery: () => void;
  onRefresh: () => void;
}

export const IncidentIntelligence: React.FC<IncidentIntelligenceProps> = ({
  incidents,
  onOpenProofGraph,
  onNavigateToRecovery,
  onRefresh,
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(incidents[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId) || incidents[0];

  const handleRunAiAnalysis = async (incidentId: string) => {
    setIsAnalyzing(true);
    try {
      await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId }),
      });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">Incident Intelligence Workspace</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#A58BFA]/15 text-[#A58BFA] border border-[#A58BFA]/30 flex items-center gap-1 font-bold">
              <Sparkles className="w-3 h-3" /> GEMINI AI ADVISORY
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Forensic analysis of payment vs delivery discrepancies using server-side Gemini 3.8 Flash intelligence
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#11151D] border border-[#232B38] rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Incidents</span>
        </button>
      </div>

      {/* AI Authority & Safety Boundary Disclaimer */}
      <div className="p-4 rounded-xl bg-[#11151D] border border-[#A58BFA]/30 flex items-start gap-3">
        <Lock className="w-5 h-5 text-[#A58BFA] shrink-0 mt-0.5" />
        <div className="text-xs">
          <h4 className="font-semibold text-[#F4F4F5]">AI Governance & Non-Executive Boundary</h4>
          <p className="text-[#A1A1AA] mt-0.5 leading-relaxed">
            The Gemini AI engine serves strictly in a <strong>forensic advisory role</strong>. It analyzes raw ledger telemetry, identifies uncertainty, and recommends actions. The AI is <strong>prohibited</strong> from authorizing payments, executing refunds, changing transaction status, or overriding the deterministic reconciliation engine. All operational recovery actions require human sign-off.
          </p>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="p-16 text-center border border-[#232B38] bg-[#11151D] rounded-2xl">
          <ShieldCheck className="w-12 h-12 text-[#C5F36A] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#F4F4F5]">No Active Discrepancies</h3>
          <p className="text-xs text-[#A1A1AA] mt-1 max-w-md mx-auto">
            All autonomous transactions in the ledger are either fully verified or within nominal payment-to-delivery invariants.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Incident Selector List (1 Col) */}
          <div className="space-y-3">
            <span className="text-xs font-mono text-[#A1A1AA] uppercase tracking-wider px-1">
              Recorded Incidents ({incidents.length})
            </span>

            {incidents.map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer bg-[#11151D] hover:bg-[#171C25] ${
                    isSelected ? 'border-[#A58BFA] ring-1 ring-[#A58BFA] shadow-[0_0_15px_rgba(165,139,250,0.15)]' : 'border-[#232B38]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FF806B]/15 text-[#FF806B] font-bold">
                      {inc.severity}
                    </span>
                    <span className="text-[10px] font-mono text-[#A1A1AA]">{inc.id}</span>
                  </div>

                  <h4 className="text-xs font-bold text-[#F4F4F5] line-clamp-1">{inc.product_name || inc.summary}</h4>
                  <p className="text-[11px] text-[#A1A1AA] mt-1 line-clamp-2">{inc.summary}</p>

                  <div className="mt-3 pt-2.5 border-t border-[#232B38] flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#A1A1AA]">{inc.agent_name}</span>
                    <span className={inc.ai_explanation ? 'text-[#A58BFA] font-semibold' : 'text-[#A1A1AA]'}>
                      {inc.ai_explanation ? 'AI Analyzed' : 'Awaiting AI'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Incident Intelligence Deep View (2 Cols) */}
          {selectedIncident && (
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-[#11151D] border border-[#232B38] space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#232B38]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#FF806B]">
                        {selectedIncident.severity} SEVERITY INCIDENT
                      </span>
                      <span className="text-[#A1A1AA]">·</span>
                      <span className="text-xs font-mono text-[#42DDF2]">{selectedIncident.id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#F4F4F5] mt-1">
                      {selectedIncident.product_name || 'Transaction Discrepancy'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenProofGraph(selectedIncident.purchase_id)}
                      className="px-3 py-1.5 text-xs font-mono font-semibold text-[#42DDF2] bg-[#42DDF2]/10 hover:bg-[#42DDF2]/20 border border-[#42DDF2]/30 rounded-lg transition-colors"
                    >
                      Proof Graph
                    </button>
                    <button
                      onClick={() => handleRunAiAnalysis(selectedIncident.id)}
                      disabled={isAnalyzing}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#090B10] bg-[#A58BFA] hover:bg-[#9274f8] rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isAnalyzing ? 'Analyzing with Gemini...' : 'Run Forensic Analysis'}</span>
                    </button>
                  </div>
                </div>

                {/* Section 1: What Happened & Affected Invariants */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#FF806B]" />
                    Reconciliation Mismatch Summary
                  </h4>
                  <div className="p-4 rounded-xl bg-[#171C25] border border-[#232B38] text-xs font-mono leading-relaxed text-[#F4F4F5]">
                    {selectedIncident.summary}
                  </div>
                </div>

                {/* Section 2: Gemini AI Explanation (Forensic Reasoning) */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-[#A58BFA] flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-[#A58BFA]" />
                    Gemini AI Forensic Explanation
                  </h4>
                  <div className="p-4 rounded-xl bg-[#A58BFA]/10 border border-[#A58BFA]/30 text-xs leading-relaxed text-[#F4F4F5] space-y-2">
                    <p>
                      {selectedIncident.ai_explanation || 
                        'No Gemini forensic analysis generated yet. Click "Run Forensic Analysis" to synthesize evidence from PayPal captures, webhook signatures, and service health probes.'}
                    </p>
                  </div>
                </div>

                {/* Section 3: Disclosed Uncertainties */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-[#42DDF2] flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#42DDF2]" />
                    Identified Uncertainties & Unknowns
                  </h4>
                  <div className="p-4 rounded-xl bg-[#171C25] border border-[#232B38] text-xs text-[#A1A1AA] leading-relaxed">
                    {selectedIncident.ai_uncertainties || 
                      'Awaiting diagnostic probe. Specific service resource allocation state remains unverified until endpoint interrogation.'}
                  </div>
                </div>

                {/* Section 4: Recommended Recovery Action */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-[#C5F36A] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C5F36A]" />
                    Recommended Recovery Course
                  </h4>
                  <div className="p-4 rounded-xl bg-[#C5F36A]/10 border border-[#C5F36A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-[#F4F4F5] leading-relaxed">
                      {selectedIncident.ai_recommended_action || 'Inspect service operation queue, verify quota availability, and proceed to Recovery Center.'}
                    </div>

                    <button
                      onClick={onNavigateToRecovery}
                      className="px-4 py-2 text-xs font-bold text-[#090B10] bg-[#C5F36A] hover:bg-[#b0df57] rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5"
                    >
                      <span>Take Action in Recovery Center</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
