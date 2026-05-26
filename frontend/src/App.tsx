import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import MainLayout from './layouts/MainLayout'
import DashboardOverview from './pages/DashboardOverview'
import ChemicalInventoryOps from './pages/ChemicalInventoryOps'
import EquipmentManagementOps from './pages/EquipmentManagementOps'
import AlertCenterLive from './pages/AlertCenterLive'
import AIWorkbench from './pages/AIWorkbench'
import SystemSettingsRuntime from './pages/SystemSettingsRuntime'
import DataImportCenter from './pages/DataImportCenter'
import AIReportPrint from './pages/AIReportPrint'
import WorkflowMonitor from './pages/WorkflowMonitor'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/ai-reports/:reportId/print" element={<AIReportPrint />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardOverview />} />
        <Route path="chemicals" element={<ChemicalInventoryOps />} />
        <Route path="inbound-outbound" element={<Navigate to="/chemicals" replace />} />
        <Route path="equipment" element={<EquipmentManagementOps />} />
        <Route path="maintenance" element={<Navigate to="/equipment" replace />} />
        <Route path="data-import" element={<DataImportCenter />} />
        <Route path="alerts" element={<AlertCenterLive />} />
        <Route path="ai-workbench" element={<AIWorkbench />} />
        <Route path="workflow-monitor" element={<WorkflowMonitor />} />
        <Route path="ai-dashboard" element={<Navigate to="/ai-workbench" replace />} />
        <Route path="ai-analysis" element={<Navigate to="/ai-workbench?tab=analysis" replace />} />
        <Route path="ai-tasks" element={<Navigate to="/ai-workbench?tab=tasks" replace />} />
        <Route path="ai-approvals" element={<Navigate to="/ai-workbench?tab=approvals" replace />} />
        <Route path="ai-reports" element={<Navigate to="/ai-workbench?tab=reports" replace />} />
        <Route path="report-delivery" element={<Navigate to="/settings?tab=delivery" replace />} />
        <Route path="settings" element={<SystemSettingsRuntime />} />
      </Route>
    </Routes>
  )
}

export default App
