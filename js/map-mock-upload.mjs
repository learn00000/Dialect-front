import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import {
  createContributionRecord,
  deleteContributionRecord
} from './map-mock-system.mjs'

const BACKEND_API_BASE = process.env.DIALECT_BACKEND_API_BASE || 'http://127.0.0.1:8000'

function toBackendApiUrl(path) {
  const base = BACKEND_API_BASE.replace(/\/$/, '')
  if (!path) return base
  if (/^https?:\/\//.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * 简易 multipart 解析（开发 Mock 用）
 * @param {Buffer} body
 * @param {string} boundary
 */
export function parseMultipartForm(body, boundary) {
  const fields = {}
  let file = null
  const separator = Buffer.from(`--${boundary}`)
  let cursor = body.indexOf(separator)
  while (cursor !== -1) {
    const next = body.indexOf(separator, cursor + separator.length)
    const part = body.subarray(cursor + separator.length, next === -1 ? body.length : next)
    cursor = next
    if (part.length < 4) continue
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd === -1) continue
    const headerText = part.subarray(0, headerEnd).toString('utf8')
    let content = part.subarray(headerEnd + 4)
    if (content.length >= 2 && content.subarray(content.length - 2).equals(Buffer.from('\r\n'))) {
      content = content.subarray(0, content.length - 2)
    }
    const nameMatch = headerText.match(/name="([^"]+)"/)
    if (!nameMatch) continue
    const name = nameMatch[1]
    const filenameMatch = headerText.match(/filename="([^"]+)"/)
    if (filenameMatch) {
      file = { field: name, filename: filenameMatch[1], buffer: content }
    } else {
      fields[name] = content.toString('utf8')
    }
  }
  return { fields, file }
}

async function readMultipart(req, res) {
  const contentType = req.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=(.+)$/i)
  if (!boundaryMatch) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ code: 1, message: '需要 multipart/form-data' }))
    return null
  }

  const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return parseMultipartForm(Buffer.concat(chunks), boundary)
}

function saveUploadFile(uploadDir, file) {
  mkdirSync(uploadDir, { recursive: true })
  const ext = file.filename?.includes('.') ? file.filename.split('.').pop() : 'webm'
  const safeExt = ['webm', 'm4a', 'mp4', 'wav', 'ogg'].includes(String(ext).toLowerCase())
    ? String(ext).toLowerCase()
    : 'webm'
  const filename = `${Date.now()}.${safeExt}`
  const filePath = join(uploadDir, filename)
  createWriteStream(filePath).end(file.buffer)
  return {
    filename,
    audioUrl: `/api/map/audio/${filename}`
  }
}

function guessMimeType(filename = '') {
  const ext = String(filename).slice(String(filename).lastIndexOf('.')).toLowerCase()
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.m4a') return 'audio/mp4'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.ogg') return 'audio/ogg'
  return 'audio/webm'
}

async function syncContributionToBackend(fields, file) {
  const formData = new FormData()
  formData.append('file', new Blob([file.buffer], { type: guessMimeType(file.filename) }), file.filename || `dialect-${Date.now()}.webm`)
  formData.append('area', String(fields.area || '').trim())
  formData.append('dialectSelfReport', String(fields.dialectSelfReport || fields.dialect || '').trim())
  formData.append('type', String(fields.type || '方言').trim())
  formData.append('content', String(fields.content || '').trim())
  formData.append('nickname', String(fields.nickname || '我').trim() || '我')
  formData.append('consentGranted', String(fields.consentGranted || 'true'))

  const response = await fetch(toBackendApiUrl('/api/contributions'), {
    method: 'POST',
    body: formData,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || data.message || `后端同步失败（${response.status}）`)
  }
  return data
}

async function syncDeleteToBackend(contributionId) {
  const response = await fetch(toBackendApiUrl(`/api/contributions/${contributionId}`), {
    method: 'DELETE',
  })
  if (response.status === 404) return
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || data.message || `后端删除失败（${response.status}）`)
  }
}

export async function listBackendMapPoints(filters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters || {})) {
    if (value == null || value === '') continue
    params.set(key, String(value))
  }
  const query = params.toString()
  const response = await fetch(toBackendApiUrl(`/api/map/points${query ? `?${query}` : ''}`))
  const data = await response.json().catch(() => [])
  if (!response.ok) {
    throw new Error(data.detail || data.message || `后端点位获取失败（${response.status}）`)
  }
  const items = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []
  return items.map((item) => ({
    ...item,
    audioUrl: toBackendApiUrl(item.audioUrl || item.audio_url || ''),
  }))
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} uploadDir
 * @param {object} opts
 * @param {import('http').ServerResponse} opts.res
 */
export async function handleContributionCreate(req, uploadDir, { res }) {
  const parsed = await readMultipart(req, res)
  if (!parsed) return
  const { fields, file } = parsed

  const area = String(fields.area || '').trim()
  const dialectSelfReport = String(fields.dialectSelfReport || '').trim()
  const consentGranted = String(fields.consentGranted || 'false') === 'true'

  if (!area || !dialectSelfReport) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ code: 1, message: '缺少地区或方言自报信息' }))
    return
  }
  if (!consentGranted) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ code: 1, message: '需要授权同意后才能上传' }))
    return
  }
  if (!file?.buffer?.length) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ code: 1, message: '缺少录音文件' }))
    return
  }

  const fileInfo = saveUploadFile(uploadDir, file)
  const backend = await syncContributionToBackend(fields, file)
  const detail = createContributionRecord(
    {
      ...fields,
      id: backend.contributionId || backend.id || '',
      dialectSelfReport: dialectSelfReport,
    },
    fileInfo
  )

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = 200
  res.end(JSON.stringify({ code: 0, message: 'ok', data: { id: detail.id, contributionId: detail.id, point: detail } }))
}

/**
 * 兼容旧接口：POST /api/map/upload
 * @param {import('http').IncomingMessage} req
 * @param {string} uploadDir
 * @param {object} opts
 * @param {import('http').ServerResponse} opts.res
 */
export async function handleLegacyMapUpload(req, uploadDir, { res }) {
  const parsed = await readMultipart(req, res)
  if (!parsed) return
  const { fields, file } = parsed

  const area = String(fields.area || '').trim()
  const dialect = String(fields.dialect || fields.dialectSelfReport || '').trim()
  if (!area || !dialect) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ code: 1, message: '缺少地区或方言信息' }))
    return
  }
  if (!file?.buffer?.length) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ code: 1, message: '缺少录音文件' }))
    return
  }

  const fileInfo = saveUploadFile(uploadDir, file)
  const backend = await syncContributionToBackend(
    {
      ...fields,
      dialectSelfReport: dialect,
      consentGranted: fields.consentGranted || 'true'
    },
    file
  )
  const detail = createContributionRecord(
    {
      ...fields,
      id: backend.contributionId || backend.id || '',
      dialectSelfReport: dialect,
      consentGranted: fields.consentGranted || 'true'
    },
    fileInfo
  )

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = 200
  res.end(JSON.stringify({ code: 0, message: 'ok', data: { id: detail.id, point: detail } }))
}

export async function deleteUploadedContribution(id, uploadDir) {
  let backendDeleted = false
  try {
    await syncDeleteToBackend(id)
    backendDeleted = true
  } catch (error) {
    if (!String(id).startsWith('seed-')) {
      throw error
    }
  }
  const removed = deleteContributionRecord(id)
  if (!removed) return backendDeleted
  if (removed.audioFilename) {
    try {
      unlinkSync(join(uploadDir, removed.audioFilename))
    } catch {
      /* 文件可能已不存在 */
    }
  }
  return true
}

const AUDIO_MIME = {
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} uploadDir
 * @param {string} filename
 */
export function serveMapUploadAudio(req, res, uploadDir, filename) {
  if (!filename || filename.includes('..') || filename.includes('/')) {
    res.statusCode = 400
    res.end('bad request')
    return
  }
  const filePath = join(uploadDir, filename)
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.statusCode = 404
      res.end('not found')
      return
    }
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    res.setHeader('Content-Type', AUDIO_MIME[ext] || 'application/octet-stream')
    res.setHeader('Content-Length', String(statSync(filePath).size))
    res.statusCode = 200
    res.end(readFileSync(filePath))
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
}
