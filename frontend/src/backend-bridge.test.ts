import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { getRoleCapabilities, hasCapability } from './backend-bridge'

test('role capability bridge keeps write permissions for non-viewer roles', () => {
  assert.equal(hasCapability('admin', 'tasks:write'), true)
  assert.equal(hasCapability('manager', 'tasks:write'), true)
  assert.equal(hasCapability('operator', 'tasks:write'), true)
  assert.equal(hasCapability('viewer', 'tasks:write'), false)
})

test('role capability bridge returns stable capability sets', () => {
  assert.deepEqual(getRoleCapabilities('viewer'), [
    'chemicals:read',
    'equipment:read',
    'alerts:read',
    'tasks:read',
    'approvals:read',
    'reports:read',
    'report_delivery:read',
    'settings:read',
  ])

  assert.equal(getRoleCapabilities('manager').includes('approvals:write'), true)
  assert.equal(getRoleCapabilities('manager').includes('reports:delete'), false)
})
