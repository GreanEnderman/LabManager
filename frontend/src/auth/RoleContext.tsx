import { createContext, useContext, useMemo, useState } from 'react'
import type { AppCapability } from '../../../backend/src/domain/authz'
import { getRoleCapabilities } from '../../../backend/src/domain/authz'
import type { UserRole } from '../../../backend/src/domain/types'

/* eslint-disable react-refresh/only-export-components */

export type AppRole = UserRole

interface RoleContextValue {
  role: AppRole
  setRole: (role: AppRole) => void
  capabilities: AppCapability[]
  can: (capability: AppCapability) => boolean
  canAny: (...required: AppCapability[]) => boolean
  isAdmin: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole>('admin')
  const capabilities = getRoleCapabilities(role)

  const value = useMemo(
    () => ({
      role,
      setRole,
      capabilities,
      can: (capability: AppCapability) => capabilities.includes(capability),
      canAny: (...required: AppCapability[]) => required.some((capability) => capabilities.includes(capability)),
      isAdmin: role === 'admin',
    }),
    [capabilities, role],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRole must be used within RoleProvider')
  }
  return context
}
