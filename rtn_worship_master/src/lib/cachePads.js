import { AUDIO_CACHE, allPadUrls } from '../audio/keys.js'

export async function prefetchPads(onProgress) {
  const urls = allPadUrls()
  const cache = await caches.open(AUDIO_CACHE)
  let done = 0

  for (const url of urls) {
    const response = await fetch(url, { cache: 'reload' })
    if (!response.ok) throw new Error(`Failed to cache ${url}`)
    await cache.put(url, response.clone())
    done += 1
    onProgress?.({ done, total: urls.length })
  }

  return { done, total: urls.length }
}

export async function cachedPadCount() {
  try {
    const cache = await caches.open(AUDIO_CACHE)
    const keys = await cache.keys()
    const wanted = new Set(allPadUrls())
    return keys.filter((request) => wanted.has(new URL(request.url).pathname)).length
  } catch {
    return 0
  }
}
