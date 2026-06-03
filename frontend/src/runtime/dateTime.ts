const LOCAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function formatLocalDateTime(value: string | number | Date | null | undefined, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return LOCAL_DATE_TIME_FORMATTER.format(date)
}
