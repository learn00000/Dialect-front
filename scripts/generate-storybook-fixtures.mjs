/**
 * 生成并缓存「粤剧·牡丹亭·杜丽娘」三页测试数据
 * 用法：node scripts/generate-storybook-fixtures.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateStorybookWithBailian, getBailianConfig } from '../js/storybook-bailian.mjs'
import { MUDANTING_TEST_CASE } from '../js/storybook-fixture.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'assets', 'storybook-test', 'mudanting')

function loadEnv() {
  const env = {}
  const path = join(ROOT, '.env')
  if (!existsSync(path)) return env
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

async function downloadToFile(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${url} -> ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
}

async function main() {
  const env = loadEnv()
  if (!env.DASHSCOPE_API_KEY) {
    console.error('请在 .env 中配置 DASHSCOPE_API_KEY')
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  console.log('正在生成测试用例：', MUDANTING_TEST_CASE)

  const result = await generateStorybookWithBailian(env, MUDANTING_TEST_CASE)
  const pages = []

  for (const page of result.pages) {
    const fileName = `page-${page.page}.png`
    const localPath = join(OUT_DIR, fileName)
    const remote = page.imageUrl

    if (remote?.startsWith('http')) {
      console.log(`下载第 ${page.page} 页…`)
      await downloadToFile(remote, localPath)
    } else {
      console.warn(`第 ${page.page} 页无远程图，跳过下载：`, remote)
    }

    pages.push({
      ...page,
      imageFile: fileName,
      imageUrl: `assets/storybook-test/mudanting/${fileName}`,
      imageSource: remote?.startsWith('http') ? 'bailian' : 'fallback',
    })
  }

  const manifest = {
    success: true,
    generatedAt: new Date().toISOString(),
    meta: { ...result.meta, ...MUDANTING_TEST_CASE, fixture: true },
    pages,
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  console.log('已写入', join(OUT_DIR, 'manifest.json'))
  console.log('完成。开发时可设 DASHSCOPE_USE_FIXTURES=true 直接使用本地三张图。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
