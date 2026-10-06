let sentinel = null

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return false
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
    return true
  } catch {
    return false
  }
}

export function bindWakeLockResume() {
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestWakeLock()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}
