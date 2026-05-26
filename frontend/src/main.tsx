import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RoleProvider } from './auth/RoleContext'
import App from './App'
import { AIProvider } from './ai/AIStateLive'
import { AISettingsRuntimeProvider } from './ai/AISettingsRuntimeLive'
import { ImportProvider } from './imports/ImportContextLive'
import './index.css'

// Frontend runtime providers must stay on the live gateway-backed path.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RoleProvider>
      <AIProvider>
        <AISettingsRuntimeProvider>
          <ImportProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ImportProvider>
        </AISettingsRuntimeProvider>
      </AIProvider>
    </RoleProvider>
  </React.StrictMode>,
)
