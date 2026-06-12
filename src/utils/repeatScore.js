/**
 * 跟读相似度评分（偏严格）：时长 + 有效发声 + 能量匹配 + 波形包络
 * @returns {Promise<number>} 0–100
 */
export async function scoreRepeatSimilarity(referenceUrl, recordedBlob) {
  if (!recordedBlob || recordedBlob.size < 800) return 0

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return 0

  const ctx = new AudioCtx()
  let userObjectUrl = ''

  try {
    userObjectUrl = URL.createObjectURL(recordedBlob)
    const [refBuf, userBuf] = await Promise.all([
      fetchAudioBuffer(referenceUrl, ctx),
      fetchAudioBuffer(userObjectUrl, ctx)
    ])

    const refDuration = Math.max(refBuf.duration, 0.01)
    const userDuration = Math.max(userBuf.duration, 0.01)
    const durRatio = Math.min(refDuration, userDuration) / Math.max(refDuration, userDuration)

    const refRms = computeRms(refBuf)
    const userRms = computeRms(userBuf)
    const refActive = activeSpeechRatio(refBuf)
    const userActive = activeSpeechRatio(userBuf)

    // 几乎没说话 / 只有环境噪
    if (userRms < 0.01 || userActive < 0.04) {
      return clampScore(Math.round(userRms * 800 + userActive * 120))
    }

    // 时长偏差过大：过短或过长都严扣
    if (durRatio < 0.45) {
      return clampScore(Math.round(durRatio * 42))
    }
    if (userDuration > refDuration * 2.2) {
      return clampScore(Math.round(38 + durRatio * 18))
    }

    const durScore = Math.pow(durRatio, 2.1)
    const energyRatio = userRms / Math.max(refRms, 0.01)
    const energyMatch = 1 - Math.min(1, Math.abs(Math.log(energyRatio + 0.001)) / 1.6)
    const activeMatch = 1 - Math.min(1, Math.abs(refActive - userActive) / Math.max(refActive, 0.08))
    const shape = correlateEnvelopes(getEnvelope(refBuf, 48), getEnvelope(userBuf, 48))
    const shapeScore = Math.pow(Math.max(0, shape), 1.45)

    // 乘法型合成：任一维度太差都会明显拉低总分
    const combined =
      Math.pow(durScore, 0.38) *
      Math.pow(Math.max(0.05, shapeScore), 0.42) *
      Math.pow(Math.max(0.05, energyMatch), 0.12) *
      Math.pow(Math.max(0.05, activeMatch), 0.08)

    const strict = Math.pow(combined, 1.55) * 100
    return clampScore(Math.round(strict))
  } catch {
    return 0
  } finally {
    if (userObjectUrl) URL.revokeObjectURL(userObjectUrl)
    await ctx.close().catch(() => {})
  }
}

function clampScore(value) {
  return Math.max(0, Math.min(96, value))
}

async function fetchAudioBuffer(url, context) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('audio fetch failed')
  const arr = await res.arrayBuffer()
  return context.decodeAudioData(arr.slice(0))
}

function computeRms(buffer) {
  const data = buffer.getChannelData(0)
  if (!data.length) return 0
  let sum = 0
  for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i]
  return Math.sqrt(sum / data.length)
}

function activeSpeechRatio(buffer, threshold = 0.018) {
  const data = buffer.getChannelData(0)
  if (!data.length) return 0
  let active = 0
  for (let i = 0; i < data.length; i += 1) {
    if (Math.abs(data[i]) > threshold) active += 1
  }
  return active / data.length
}

function getEnvelope(buffer, buckets = 48) {
  const data = buffer.getChannelData(0)
  const size = Math.max(1, Math.floor(data.length / buckets))
  const env = []
  for (let b = 0; b < buckets; b += 1) {
    let sum = 0
    const start = b * size
    const end = Math.min(start + size, data.length)
    for (let i = start; i < end; i += 1) sum += Math.abs(data[i])
    env.push(sum / (end - start || 1))
  }
  const max = Math.max(...env, 0.0001)
  return env.map((v) => v / max)
}

function correlateEnvelopes(a, b) {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}
