/**
 * 粤剧《牡丹亭》测试用例缓存（本地剧照 + 剧本文案）
 * 由 scripts/generate-storybook-fixtures.mjs 生成/更新
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, '..', 'assets', 'storybook-test', 'mudanting')
const MANIFEST_PATH = join(FIXTURE_DIR, 'manifest.json')

export const MUDANTING_TEST_CASE = {
  dialect: '粤语',
  opera: '粤剧《牡丹亭》',
  role: '杜丽娘（闺门旦）',
}

export function loadMudantingFixture() {
  if (!existsSync(MANIFEST_PATH)) return null
  try {
    const raw = readFileSync(MANIFEST_PATH, 'utf-8')
    const data = JSON.parse(raw)
    if (!data?.pages?.length) return null
    data.pages = data.pages.map((p) => ({
      ...p,
      imageUrl: p.imageUrl?.startsWith('http')
        ? p.imageUrl
        : `assets/storybook-test/mudanting/${p.imageFile || `page-${p.page}.png`}`,
    }))
    return data
  } catch {
    return null
  }
}

export function isMudantingTestCase(params) {
  return (
    params.dialect === MUDANTING_TEST_CASE.dialect &&
    params.opera === MUDANTING_TEST_CASE.opera &&
    params.role === MUDANTING_TEST_CASE.role
  )
}

export function getFixturePageImage(pageNum) {
  const file = join(FIXTURE_DIR, `page-${pageNum}.png`)
  return existsSync(file) ? `assets/storybook-test/mudanting/page-${pageNum}.png` : null
}
