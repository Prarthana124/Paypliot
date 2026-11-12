import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { CommandCenter } from './components/CommandCenter';
import { AgentRegistry } from './components/AgentRegistry';
import { AuthorizationLab } from './components/AuthorizationLab';
import { TransactionExplorer } from './components/TransactionExplorer';
import { ProofGraphView } from './components/ProofGraphView';
import { IncidentIntelligence } from './components/IncidentIntelligence';
import { RecoveryCenter } from './components/RecoveryCenter';
import { EvidenceVault } from './components/EvidenceVault';
import { IntegrationsView } from './components/IntegrationsView';
import { SettingsView } from './components/SettingsView';
import { SystemVerificationView } from './components/SystemVerificationView';
import { NewTransactionModal } from './components/NewTransactionModal';
import { 
  Agent, 
  Authorization, 
  PurchaseItem, 
  PurchaseDetail, 
  Incident, 
  RecoveryProposal 
} from './types';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('command_center');
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [recoveryProposals, setRecoveryProposals] = useState<RecoveryProposal[]>([]);
  
  // Selected purchase for Proof Graph & Deep Inspection
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<PurchaseDetail | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'alert' | 'info' } | null>(null);

  const showToast = (title: string, desc: string, type: 'success' | 'alert' | 'info' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchPurchases = async () => {
    try {
      const res = await fetch('/api/purchases');
      const data = await res.json();
      setPurchases(data);

      // If we don't have an active selected purchase yet, default to the first one
      if (data.length > 0 && !selectedPurchaseId) {
        setSelectedPurchaseId(data[0].id);
        fetchPurchaseDetail(data[0].id);
      }
    } catch (e) {
      console.error('Error fetching purchases:', e);
    }
  };

  const fetchPurchaseDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/purchases/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPurchaseDetail(data);
        setSelectedPurchaseId(id);
      }
    } catch (e) {
      console.error('Error fetching purchase detail:', e);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data);
    } catch (e) {
      console.error('Error fetching agents:', e);
    }
  };

  const fetchAuthorizations = async () => {
    try {
      const res = await fetch('/api/authorizations');
      const data = await res.json();
      setAuthorizations(data);
    } catch (e) {
      console.error('Error fetching authorizations:', e);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      setIncidents(data);
    } catch (e) {
      console.error('Error fetching incidents:', e);
    }
  };

  const fetchRecoveryProposals = async () => {
    try {
      const res = await fetch('/api/recovery/proposals');
      const data = await res.json();
      setRecoveryProposals(data);
    } catch (e) {
      console.error('Error fetching recovery proposals:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/paypal/config');
      const data = await res.json();
      setIsDemoMode(data.mode === 'DEMO');
    } catch (e) {
      console.error('Error fetching paypal config:', e);
    }
  };

  const refreshAllData = () => {
    fetchPurchases();
    fetchAgents();
    fetchAuthorizations();
    fetchIncidents();
    fetchRecoveryProposals();
    fetchConfig();
    if (selectedPurchaseId) {
      fetchPurchaseDetail(selectedPurchaseId);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleOpenProofGraph = (purchaseId: string) => {
    fetchPurchaseDetail(purchaseId);
    setCurrentTab('proof_graph');
  };

  const handleOpenDetails = (purchaseId: string) => {
    fetchPurchaseDetail(purchaseId);
    setCurrentTab('proof_graph');
  };

  const handleRunDemoScenario = async (scenarioNum: 1 | 2 | 3 | 4) => {
    try {
      showToast('Scenario Triggered', `Executing Demo Scenario #${scenarioNum} in background...`, 'info');
      const res = await fetch('/api/demo/run-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioNum }),
      });
      const data = await res.json();
      refreshAllData();
      if (data.purchaseId) {
        fetchPurchaseDetail(data.purchaseId);
        showToast(
          `Scenario #${scenarioNum} Completed`,
          `Transaction ${data.purchaseId} is in status ${data.status}.`,
          data.status === 'FULLY_VERIFIED' ? 'success' : 'alert'
        );
      }
    } catch (err: any) {
      showToast('Scenario Error', err.message, 'alert');
    }
  };

  const handleTransactionCreated = (purchaseId: string) => {
    refreshAllData();
    fetchPurchaseDetail(purchaseId);
    showToast('Purchase Initialized', `Transaction ${purchaseId} processed by gateway and orchestrator.`, 'success');
    setCurrentTab('proof_graph');
  };

  return (
    <div className="min-h-screen bg-[#090B10] text-[#F4F4F5] flex flex-col font-sans selection:bg-[#42DDF2]/20 selection:text-[#42DDF2]">
      
      {/* Top Navigation Bar */}
      <Navbar
        onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
        onRunScenario={handleRunDemoScenario}
        isDemoMode={isDemoMode}
        incidentCount={incidents.filter(i => i.status === 'OPEN').length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Workspace Split: Sidebar + Dynamic Main Content */}
      <div className="flex-1 flex w-full">
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          openIncidentsCount={incidents.filter(i => i.status === 'OPEN').length}
          pendingProposalsCount={recoveryProposals.filter(p => p.approval_status === 'PENDING').length}
        />

        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {currentTab === 'command_center' && (
            <CommandCenter
              purchases={purchases}
              incidents={incidents}
              recoveryProposals={recoveryProposals}
              onSelectPurchase={(id) => {
                fetchPurchaseDetail(id);
                setCurrentTab('proof_graph');
              }}
              onOpenProofGraph={handleOpenProofGraph}
              onRunDemoScenario={handleRunDemoScenario}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'system_verification' && (
            <SystemVerificationView />
          )}

          {currentTab === 'agent_registry' && (
            <AgentRegistry
              agents={agents}
              purchases={purchases}
              onRefresh={refreshAllData}
              onOpenProofGraph={handleOpenProofGraph}
            />
          )}

          {currentTab === 'authorization_lab' && (
            <AuthorizationLab
              agents={agents}
              authorizations={authorizations}
              onRefresh={refreshAllData}
            />
          )}

          {currentTab === 'transaction_explorer' && (
            <TransactionExplorer
              purchases={purchases}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onOpenProofGraph={handleOpenProofGraph}
              onOpenDetails={handleOpenDetails}
            />
          )}

          {currentTab === 'proof_graph' && (
            <div className="space-y-6">
              {/* Transaction Selector Toolbar for Proof Graph */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#11151D] border border-[#232B38]">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#A1A1AA]">Active Inspected Transaction</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-[#F4F4F5]">
                      {selectedPurchaseDetail?.purchase.product_name || 'No Transaction Selected'}
                    </span>
                    <span className="text-xs font-mono text-[#42DDF2]">
                      ({selectedPurchaseDetail?.purchase.id || 'N/A'})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedPurchaseId}
                    onChange={(e) => {
                      setSelectedPurchaseId(e.target.value);
                      fetchPurchaseDetail(e.target.value);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#171C25] border border-[#232B38] text-xs font-mono text-[#F4F4F5]"
                  >
                    {purchases.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.product_name} ({p.reconciliation_status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ProofGraphView
                purchaseDetail={selectedPurchaseDetail}
                onRefresh={refreshAllData}
              />
            </div>
          )}

          {currentTab === 'incident_intelligence' && (
            <IncidentIntelligence
              incidents={incidents}
              onOpenProofGraph={handleOpenProofGraph}
              onNavigateToRecovery={() => setCurrentTab('recovery_center')}
              onRefresh={refreshAllData}
            />
          )}

          {currentTab === 'recovery_center' && (
            <RecoveryCenter
              proposals={recoveryProposals}
              onOpenProofGraph={handleOpenProofGraph}
              onRefresh={refreshAllData}
            />
          )}

          {currentTab === 'evidence_vault' && (
            <EvidenceVault
              purchases={purchases}
              selectedPurchaseId={selectedPurchaseId}
              onOpenProofGraph={handleOpenProofGraph}
            />
          )}

          {currentTab === 'integrations' && (
            <IntegrationsView />
          )}

          {currentTab === 'settings' && (
            <SettingsView onRefreshAll={refreshAllData} />
          )}
        </main>
      </div>

      {/* New Transaction Simulation Modal */}
      <NewTransactionModal
        agents={agents}
        isOpen={isNewTxModalOpen}
        onClose={() => setIsNewTxModalOpen(false)}
        onTransactionCreated={handleTransactionCreated}
      />

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 p-4 rounded-2xl bg-[#11151D] border border-[#232B38] shadow-2xl max-w-sm animate-in fade-in slide-in-from-bottom-5">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#C5F36A] shrink-0 mt-0.5" />
          ) : toastMessage.type === 'alert' ? (
            <AlertTriangle className="w-5 h-5 text-[#FF806B] shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-[#42DDF2] shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-[#F4F4F5]">{toastMessage.title}</h4>
            <p className="text-[#A1A1AA] mt-0.5 leading-snug">{toastMessage.desc}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-[#A1A1AA] hover:text-[#F4F4F5]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
}
