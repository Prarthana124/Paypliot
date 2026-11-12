import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Server,
  Layers,
  Sparkles,
  Download,
  Filter,
  CheckCheck,
  ChevronRight,
  Info,
  Hash,
  AlertCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';

export type TestStatus =
  | 'PASS'
  | 'FAIL'
  | 'RUNNING'
  | 'NOT CONFIGURED'
  | 'NOT TESTED'
  | 'WAITING FOR USER ACTION';

export interface VerificationTestItem {
  id: string;
  groupName: 'BACKEND' | 'PAYPAL_SANDBOX' | 'PROVISIONING' | 'RECONCILIATION' | 'RECOVERY' | 'AI_INTELLIGENCE';
  testName: string;
  description: string;
  status: TestStatus;
  actualResult: string;
  errorDetails?: string;
  evidenceRef?: string;
  actionUrl?: string;
  actionLabel?: string;
  executedAt: string;
}

export interface VerificationRunSummary {
  runId: string;
  runType: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  waitingTests: number;
  notConfiguredTests: number;
  summary: string;
  startedAt: string;
  completedAt: string;
  tests: VerificationTestItem[];
}

type GroupFilter =
  | 'ALL'
  | 'BACKEND'
  | 'PAYPAL_SANDBOX'
  | 'PROVISIONING'
  | 'RECONCILIATION'
  | 'RECOVERY'
  | 'AI_INTELLIGENCE';

export const SystemVerificationView: React.FC = () => {
  const [runSummary, setRunSummary] = useState<VerificationRunSummary | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupFilter>('ALL');
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningGroup, setRunningGroup] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  // Interactive PayPal Sandbox Lab State
  const [interactiveOrder, setInteractiveOrder] = useState<{
    orderId: string;
    approvalUrl: string;
    status: string;
    purchaseId: string;
  } | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCheckingOrder, setIsCheckingOrder] = useState(false);
  const [isCapturingOrder, setIsCapturingOrder] = useState(false);
  const [interactiveLog, setInteractiveLog] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/verification/history');
      if (res.ok) {
        const data = await res.json();
        if (data.totalTests > 0) {
          setRunSummary(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch verification history:', e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRunAllTests = async () => {
    setIsRunningAll(true);
    setInteractiveLog('Executing complete test suite across 6 verification subsystems...');
    try {
      const res = await fetch('/api/verification/run-all', { method: 'POST' });
      const data = await res.json();
      setRunSummary(data);
      setInteractiveLog(`Verification run completed! ${data.passedTests} passed, ${data.failedTests} failed, ${data.waitingTests} waiting on user approval.`);
    } catch (e: any) {
      setInteractiveLog(`Verification run error: ${e.message}`);
    } finally {
      setIsRunningAll(false);
    }
  };

  const handleRunGroup = async (groupName: GroupFilter) => {
    if (groupName === 'ALL') {
      return handleRunAllTests();
    }
    setRunningGroup(groupName);
    try {
      const res = await fetch('/api/verification/run-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName }),
      });
      const data = await res.json();
      // Merge into current summary
      if (runSummary) {
        const otherTests = runSummary.tests.filter((t) => t.groupName !== groupName);
        const mergedTests = [...otherTests, ...data.tests];
        setRunSummary({
          ...runSummary,
          runId: data.runId,
          tests: mergedTests,
          passedTests: mergedTests.filter((t) => t.status === 'PASS').length,
          failedTests: mergedTests.filter((t) => t.status === 'FAIL').length,
          waitingTests: mergedTests.filter((t) => t.status === 'WAITING FOR USER ACTION').length,
          notConfiguredTests: mergedTests.filter((t) => t.status === 'NOT CONFIGURED').length,
          totalTests: mergedTests.length,
        });
      } else {
        setRunSummary(data);
      }
    } catch (e: any) {
      console.error('Failed to run group:', e);
    } finally {
      setRunningGroup(null);
    }
  };

  // Interactive PayPal Sandbox Actions
  const handleCreateInteractiveOrder = async () => {
    setIsCreatingOrder(true);
    setInteractiveLog('Creating live order on PayPal Sandbox (v2/checkout/orders)...');
    try {
      const res = await fetch('/api/verification/paypal/create-approval-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 15.0 }),
      });
      const data = await res.json();
      setInteractiveOrder(data);
      setInteractiveLog(`Created Sandbox Order ${data.orderId}! Status: '${data.status}'. Payer must authorize via approval URL.`);
    } catch (e: any) {
      setInteractiveLog(`Order creation failed: ${e.message}`);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleCheckInteractiveOrder = async () => {
    if (!interactiveOrder) return;
    setIsCheckingOrder(true);
    try {
      const res = await fetch(`/api/verification/paypal/check-order/${interactiveOrder.orderId}`);
      const data = await res.json();
      setInteractiveOrder({
        ...interactiveOrder,
        status: data.status,
      });
      setInteractiveLog(`Checked PayPal Order ${data.orderId}: Current remote status is '${data.status}'.`);
    } catch (e: any) {
      setInteractiveLog(`Check order failed: ${e.message}`);
    } finally {
      setIsCheckingOrder(false);
    }
  };

  const handleCaptureInteractiveOrder = async () => {
    if (!interactiveOrder) return;
    setIsCapturingOrder(true);
    try {
      const res = await fetch(`/api/verification/paypal/capture-order/${interactiveOrder.orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId: interactiveOrder.purchaseId }),
      });
      const data = await res.json();
      if (data.status === 'COMPLETED') {
        setInteractiveLog(`SUCCESS! Captured PayPal Order ${interactiveOrder.orderId}. Capture ID: ${data.captureId}. Funds confirmed.`);
        setInteractiveOrder({
          ...interactiveOrder,
          status: 'COMPLETED',
        });
        // Re-run PayPal verification to reflect changes
        handleRunGroup('PAYPAL_SANDBOX');
      } else {
        setInteractiveLog(`Capture returned status: ${data.status}. Reason: ${data.raw?.error || 'Order has not been authorized by buyer in PayPal Sandbox yet.'}`);
      }
    } catch (e: any) {
      setInteractiveLog(`Capture failed: ${e.message}`);
    } finally {
      setIsCapturingOrder(false);
    }
  };

  // Export report as JSON
  const handleExportJson = () => {
    if (!runSummary) return;
    const blob = new Blob([JSON.stringify(runSummary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paypilot-verification-report-${runSummary.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export report as Markdown
  const handleExportMarkdown = () => {
    if (!runSummary) return;
    const md = `# PAYPILOT — COMPLETE SYSTEM VERIFICATION REPORT
**Run Identifier**: \`${runSummary.runId}\`
**Executed**: ${runSummary.completedAt}
**Execution Summary**: ${runSummary.summary}

## 1. Executive Summary
- **Total Tests Executed**: ${runSummary.totalTests}
- **Tests Passed**: ${runSummary.passedTests} ✅
- **Tests Failed**: ${runSummary.failedTests} ${runSummary.failedTests > 0 ? '❌' : '✅'}
- **Waiting for User Action**: ${runSummary.waitingTests} ⏳
- **Not Configured**: ${runSummary.notConfiguredTests}

---

## 2. Detailed Test Results by Subsystem

${runSummary.tests
  .map(
    (t, idx) => `### ${idx + 1}. [${t.status}] ${t.testName} (${t.groupName})
- **Description**: ${t.description}
- **Status**: \`${t.status}\`
- **Actual Result**: ${t.actualResult}
${t.errorDetails ? `- **Error Details**: \`${t.errorDetails}\`` : ''}
${t.evidenceRef ? `- **Evidence / API Reference**: \`${t.evidenceRef}\`` : ''}
- **Timestamp**: ${t.executedAt}
`
  )
  .join('\n')}
`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paypilot-verification-report-${runSummary.runId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allTests = runSummary?.tests || [];
  const filteredTests =
    activeGroup === 'ALL'
      ? allTests
      : allTests.filter((t) => t.groupName === activeGroup);

  const getStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C5F36A]/10 text-[#C5F36A] border border-[#C5F36A]/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>PASS</span>
          </span>
        );
      case 'FAIL':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF806B]/15 text-[#FF806B] border border-[#FF806B]/40">
            <AlertTriangle className="w-3 h-3" />
            <span>FAIL</span>
          </span>
        );
      case 'WAITING FOR USER ACTION':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#42DDF2]/15 text-[#42DDF2] border border-[#42DDF2]/40 animate-pulse">
            <Clock className="w-3 h-3" />
            <span>WAITING ON USER</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <RotateCcw className="w-3 h-3 animate-spin" />
            <span>RUNNING</span>
          </span>
        );
      case 'NOT CONFIGURED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <AlertCircle className="w-3 h-3" />
            <span>NOT CONFIGURED</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-800 text-zinc-500 border border-zinc-700">
            <span>NOT TESTED</span>
          </span>
        );
    }
  };

  const groupTabs: { key: GroupFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All Subsystems', count: allTests.length },
    { key: 'BACKEND', label: '1. Backend Core (20)', count: allTests.filter((t) => t.groupName === 'BACKEND').length },
    { key: 'PAYPAL_SANDBOX', label: '2. PayPal Sandbox (6)', count: allTests.filter((t) => t.groupName === 'PAYPAL_SANDBOX').length },
    { key: 'PROVISIONING', label: '3. Provisioning (6)', count: allTests.filter((t) => t.groupName === 'PROVISIONING').length },
    { key: 'RECONCILIATION', label: '4. Reconciliation (7)', count: allTests.filter((t) => t.groupName === 'RECONCILIATION').length },
    { key: 'RECOVERY', label: '5. Recovery Governance (7)', count: allTests.filter((t) => t.groupName === 'RECOVERY').length },
    { key: 'AI_INTELLIGENCE', label: '6. AI Intelligence (6)', count: allTests.filter((t) => t.groupName === 'AI_INTELLIGENCE').length },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-7xl">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-[#11151D] border border-[#232B38] relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#C5F36A]/10 text-[#C5F36A] border border-[#C5F36A]/20">
              <CheckCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#F4F4F5] tracking-tight">System Verification Center</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-[#42DDF2]/15 text-[#42DDF2] border border-[#42DDF2]/30">
              LIVE SYSTEM AUDIT
            </span>
          </div>
          <p className="text-xs text-[#A1A1AA] max-w-2xl leading-relaxed">
            Independent end-to-end verification harness. Tests backend persistence, live PayPal Sandbox OAuth & Orders APIs, multi-stage digital provisioning, deterministic reconciliation invariants, human recovery approval gates, and server-side forensic AI boundaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button
            onClick={handleExportJson}
            disabled={!runSummary}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#171C25] border border-[#232B38] rounded-xl transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            disabled={!runSummary}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#171C25] border border-[#232B38] rounded-xl transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Markdown</span>
          </button>

          <button
            onClick={handleRunAllTests}
            disabled={isRunningAll}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-[#090B10] bg-[#C5F36A] hover:bg-[#b3e354] rounded-xl transition-all shadow-[0_0_15px_rgba(197,243,106,0.3)] disabled:opacity-50"
          >
            {isRunningAll ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Running Complete Suite...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>RUN ALL TESTS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. KPI Scorecard Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-[#11151D] border border-[#232B38]">
          <span className="text-[11px] font-mono text-[#A1A1AA] block uppercase">Total Invariants</span>
          <span className="text-2xl font-bold font-mono text-[#F4F4F5] mt-1 block tabular-nums">
            {runSummary?.totalTests || 0}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#11151D] border border-[#C5F36A]/30">
          <span className="text-[11px] font-mono text-[#C5F36A] block uppercase">Passed Invariants</span>
          <span className="text-2xl font-bold font-mono text-[#C5F36A] mt-1 block tabular-nums">
            {runSummary?.passedTests || 0}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#11151D] border border-[#FF806B]/30">
          <span className="text-[11px] font-mono text-[#FF806B] block uppercase">Failed Invariants</span>
          <span className="text-2xl font-bold font-mono text-[#FF806B] mt-1 block tabular-nums">
            {runSummary?.failedTests || 0}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#11151D] border border-[#42DDF2]/30">
          <span className="text-[11px] font-mono text-[#42DDF2] block uppercase">Waiting on User</span>
          <span className="text-2xl font-bold font-mono text-[#42DDF2] mt-1 block tabular-nums">
            {runSummary?.waitingTests || 0}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#11151D] border border-[#232B38] col-span-2 sm:col-span-1">
          <span className="text-[11px] font-mono text-[#A1A1AA] block uppercase">Latest Run Stamp</span>
          <span className="text-xs font-mono text-[#A1A1AA] mt-2 block truncate">
            {runSummary ? runSummary.completedAt.split('T')[1].split('.')[0] + ' UTC' : 'Not Run Yet'}
          </span>
        </div>
      </div>

      {/* 3. Interactive PayPal Sandbox Verification Station */}
      <div className="p-6 rounded-2xl bg-[#11151D] border border-[#42DDF2]/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232B38]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#42DDF2]/10 text-[#42DDF2]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F4F4F5]">Interactive PayPal Sandbox Verification Station</h3>
              <p className="text-[11px] text-[#A1A1AA]">
                Live sandbox order creation, buyer authorization workflow, and server-side capture verification.
              </p>
            </div>
          </div>

          <button
            onClick={handleCreateInteractiveOrder}
            disabled={isCreatingOrder}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold text-[#090B10] bg-[#42DDF2] hover:bg-[#34cbe0] rounded-xl transition-all self-start sm:self-auto disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isCreatingOrder ? 'Creating Live Order...' : '1. Create Live Sandbox Order'}</span>
          </button>
        </div>

        {interactiveOrder ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono pt-1">
            <div className="p-3.5 rounded-xl bg-[#171C25] border border-[#232B38] space-y-1">
              <span className="text-[#A1A1AA] text-[10px] block">LIVE PAYPAL ORDER ID</span>
              <span className="text-[#F4F4F5] font-bold block">{interactiveOrder.orderId}</span>
              <span className="text-[#42DDF2] text-[10px] block">Status: {interactiveOrder.status}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#171C25] border border-[#232B38] space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[#A1A1AA] text-[10px] block">BUYER APPROVAL URL</span>
                <span className="text-[#A1A1AA] text-[11px] block truncate">{interactiveOrder.approvalUrl}</span>
              </div>
              <a
                href={interactiveOrder.approvalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C5F36A] hover:underline"
              >
                <span>2. Open PayPal Approval Page</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-3.5 rounded-xl bg-[#171C25] border border-[#232B38] space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[#A1A1AA] text-[10px] block">CAPTURE VERIFICATION</span>
                <span className="text-[11px] text-[#A1A1AA] block">
                  {interactiveOrder.status === 'COMPLETED'
                    ? 'Payment captured server-side!'
                    : 'Awaiting buyer approval before capture'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCheckInteractiveOrder}
                  disabled={isCheckingOrder}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-[#232B38] text-[#F4F4F5] hover:bg-[#2c3747] transition-colors"
                >
                  {isCheckingOrder ? 'Checking...' : 'Check Status'}
                </button>
                <button
                  onClick={handleCaptureInteractiveOrder}
                  disabled={isCapturingOrder || interactiveOrder.status === 'COMPLETED'}
                  className="px-3 py-1 text-[11px] font-bold rounded-lg bg-[#C5F36A] text-[#090B10] hover:bg-[#b0df57] transition-colors disabled:opacity-40"
                >
                  {isCapturingOrder ? 'Capturing...' : '3. Capture Payment'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#171C25] text-xs text-[#A1A1AA] font-mono flex items-center justify-between">
            <span>No interactive order active. Click "1. Create Live Sandbox Order" to test the real PayPal payment flow.</span>
            <span className="text-[11px] text-[#42DDF2]">Sandbox Ready</span>
          </div>
        )}

        {interactiveLog && (
          <div className="p-3 rounded-xl bg-[#090B10] border border-[#232B38] text-[11px] font-mono text-[#42DDF2]">
            {interactiveLog}
          </div>
        )}
      </div>

      {/* 4. Subsystem Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#11151D] border border-[#232B38] rounded-xl">
          {groupTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveGroup(tab.key)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 ${
                activeGroup === tab.key
                  ? 'bg-[#171C25] text-[#F4F4F5] font-bold border border-[#232B38] shadow-xs'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#232B38] text-[#A1A1AA]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeGroup !== 'ALL' && (
          <button
            onClick={() => handleRunGroup(activeGroup)}
            disabled={runningGroup === activeGroup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-[#42DDF2] bg-[#42DDF2]/10 hover:bg-[#42DDF2]/20 border border-[#42DDF2]/30 rounded-xl transition-colors self-start sm:self-auto disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${runningGroup === activeGroup ? 'animate-spin' : ''}`} />
            <span>Run {groupTabs.find((t) => t.key === activeGroup)?.label}</span>
          </button>
        )}
      </div>

      {/* 5. Invariants Verification Table / Cards */}
      <div className="space-y-3">
        {filteredTests.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#11151D] border border-[#232B38] space-y-3">
            <CheckCheck className="w-10 h-10 text-[#A1A1AA] mx-auto animate-pulse" />
            <h4 className="text-sm font-bold text-[#F4F4F5]">No Tests Run Yet</h4>
            <p className="text-xs text-[#A1A1AA] max-w-md mx-auto">
              Click "RUN ALL TESTS" above to execute all 52 backend, PayPal sandbox, provisioning, reconciliation, recovery, and AI intelligence verifications.
            </p>
          </div>
        ) : (
          filteredTests.map((test, index) => {
            const isExpanded = expandedTestId === test.id;
            return (
              <div
                key={`${test.groupName}-${test.id}-${index}`}
                className="p-4 rounded-xl bg-[#11151D] border border-[#232B38] hover:border-[#343e50] transition-all space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5">
                    {getStatusBadge(test.status)}
                    <div>
                      <h4 className="text-xs font-bold text-[#F4F4F5]">{test.testName}</h4>
                      <p className="text-[11px] text-[#A1A1AA] mt-0.5">{test.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {test.actionUrl && (
                      <a
                        href={test.actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold text-[#090B10] bg-[#42DDF2] hover:bg-[#32c0d4] rounded-lg transition-colors"
                      >
                        <span>{test.actionLabel || 'Approve on PayPal'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span className="text-[10px] font-mono text-[#A1A1AA]">
                      {test.executedAt.split('T')[1].split('.')[0]} UTC
                    </span>
                    <button
                      onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                      className="p-1 text-[#A1A1AA] hover:text-[#F4F4F5]"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Actual Outcome Display */}
                <div className="mt-2 p-3 rounded-lg bg-[#171C25] border border-[#232B38]/80 text-xs font-mono text-[#F4F4F5] leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-bold">
                      VERIFIED OUTCOME
                    </span>
                    <span className="text-xs text-[#E4E4E7]">{test.actualResult}</span>
                  </div>

                  {test.evidenceRef && (
                    <span className="text-[10px] font-mono text-[#42DDF2] bg-[#42DDF2]/10 border border-[#42DDF2]/20 px-2 py-0.5 rounded whitespace-nowrap self-start sm:self-auto">
                      Ref: {test.evidenceRef}
                    </span>
                  )}
                </div>

                {/* Expandable Error Details */}
                {test.errorDetails && (
                  <div className="p-3 rounded-lg bg-[#FF806B]/10 border border-[#FF806B]/30 text-xs font-mono text-[#FF806B]">
                    <span className="font-bold block text-[10px] uppercase">Failure Details:</span>
                    <span className="mt-0.5 block">{test.errorDetails}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
