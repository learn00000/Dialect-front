import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getLocationByAreaString } from '../src/data/map-regions.js'

/**
 * 简易 multipart 解析（开发 Mock 用）
 * @param {Buffer} body
 * @param {string} boundary
 */
export function parseMultipartForm(body, boundary) {
  const fields = {}
  let file = null
  const sep = Buffer.from(`--${boundary}`)
  let pos = body.indexOf(sep)
  while (pos !== -1) {
    const next = body.indexOf(sep, pos + sep.length)
    const part = body.subarray(pos + sep.length, next === -1 ? body.length : next)
    pos = next
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

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} uploadDir
 * @param {object} opts
 * @param {import('http').ServerResponse} opts.res
 * @param {object[]} opts.mockPoints
 */
export async function handleMapUpload(req, uploadDir, { res, mockPoints }) {
  const contentType = req.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=(.+)$/i)
  if (!boundaryMatch) {
    res.statusCode = 400
    res.end(JSON.stringify({ code: 1, message: '需要 multipart/form-data' }))
    return
  }
  const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)
  const { fields, file } = parseMultipartForm(body, boundary)

  const area = String(fields.area || '').trim()
  const dialect = String(fields.dialect || '').trim()
  const type = String(fields.type || '方言').trim()
  const content = String(fields.content || '').trim()
  const nickname = String(fields.nickname || '访客上传').trim()

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

  const id = String(Date.now())
  mkdirSync(uploadDir, { recursive: true })
  const ext = file.filename?.includes('.') ? file.filename.split('.').pop() : 'webm'
  const safeExt = ['webm', 'm4a', 'mp4', 'wav', 'ogg'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'webm'
  const filename = `${id}.${safeExt}`
  const filePath = join(uploadDir, filename)
  createWriteStream(filePath).end(file.buffer)

  const location = getLocationByAreaString(area)
  const audioUrl = `/api/map/audio/${filename}`
  const time = new Date().toISOString().slice(0, 19).replace('T', ' ')

  const point = {
    id,
    location,
    area,
    dialect,
    type,
    audioUrl,
    content: content || '（用户上传录音）',
    nickname,
    time,
    uploaded: true
  }

  mockPoints.push(point)

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = 200
  res.end(JSON.stringify({ code: 0, message: 'ok', data: { id, point } }))
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
