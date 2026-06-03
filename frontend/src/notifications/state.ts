const READ_NOTIFICATION_IDS_KEY = 'labmanager:notification-center:read-ids'
const ANNOUNCED_NOTIFICATION_IDS_KEY = 'labmanager:notification-center:announced-ids'
const NOTIFICATION_READ_STATE_EVENT = 'labmanager:notification-center:read-state-change'
const MAX_STORED_NOTIFICATION_IDS = 300

function readIdList(key: string) {
  if (typeof window === 'undefined') return []

  try {
    const value = window.localStorage.getItem(key)
    if (!value) return []
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeIdList(key: string, ids: string[]) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(ids.slice(-MAX_STORED_NOTIFICATION_IDS)))
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

function mergeIds(currentIds: string[], nextIds: string[]) {
  return Array.from(new Set([...currentIds, ...nextIds])).slice(-MAX_STORED_NOTIFICATION_IDS)
}

export function readNotificationReadIds() {
  return readIdList(READ_NOTIFICATION_IDS_KEY)
}

export function readNotificationAnnouncedIds() {
  return readIdList(ANNOUNCED_NOTIFICATION_IDS_KEY)
}

export function markNotificationsRead(ids: string[]) {
  writeIdList(READ_NOTIFICATION_IDS_KEY, mergeIds(readNotificationReadIds(), ids))
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(NOTIFICATION_READ_STATE_EVENT))
}

export function markNotificationsAnnounced(ids: string[]) {
  writeIdList(ANNOUNCED_NOTIFICATION_IDS_KEY, mergeIds(readNotificationAnnouncedIds(), ids))
}

export function getUnreadNotificationCount(notificationIds: string[]) {
  const readIds = new Set(readNotificationReadIds())
  return notificationIds.filter((id) => !readIds.has(id)).length
}

export function subscribeNotificationReadState(listener: () => void) {
  window.addEventListener(NOTIFICATION_READ_STATE_EVENT, listener)
  return () => window.removeEventListener(NOTIFICATION_READ_STATE_EVENT, listener)
}
