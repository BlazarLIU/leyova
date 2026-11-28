import type { Browser, BrowserContext } from 'playwright'

/**
 * 合规规则公开页渲染抓取
 *
 * 现实约束（2026-11 实测）：
 *   · 抖音电商学习中心、快手电商规则中心的规则页都是 SPA，服务端直连只能拿到空壳 HTML；
 *   · 规则详情页与列表页均需 JS 渲染后才出现正文；
 *   · 未登录可访问的只有「公开规则中心」，后台专属规则仍在登录态内，一律不碰。
 *
 * 因此这里用无头 Chromium 渲染公开页。合规红线保持：
 *   1. 只允许白名单域名；
 *   2. 遇 login/passport/captcha 跳转立即放弃（不注入任何 Cookie/Token）；
 *   3. 同域请求间隔 >= 1500ms；
 *   4. 页面正文过短（< 80 字）视为被拦截或加载失败，不入库。
 */

const ALLOWED_HOSTS = [
  'school.jinritemai.com',
  'jinritemai.com',
  'edu.kwaixiaodian.com',
  'kwaixiaodian.com',
]

const MIN_CONTENT_LENGTH = 80
const NAV_TIMEOUT_MS = 30_000
const SETTLE_TIMEOUT_MS = 8_000
const MAX_TEXT_LENGTH = 8_000
const MIN_INTERVAL_MS = 1_500

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 LeyovaComplianceBot/1.0'

export interface RenderedPage {
  url: string
  title: string
  text: string
  links: Array<{ url: string; text: string }>
}

let browserPromise: Promise<Browser | null> | null = null
let contextPromise: Promise<BrowserContext | null> | null = null
const lastRequestAt = new Map<string, number>()

/** 抓取开关：测试环境与显式关闭时不发起任何外网请求 */
export function crawlerEnabled(): boolean {
  if (process.env.COMPLIANCE_CRAWLER === 'off') return false
  return process.env.NODE_ENV !== 'test'
}

export function isAllowedUrl(raw: string): boolean {
  try {
    const { hostname, protocol } = new URL(raw)
    if (protocol !== 'https:') return false
    return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

async function getBrowser(): Promise<Browser | null> {
  if (!browserPromise) {
    browserPromise = (async () => {
      try {
        // 动态导入：未安装 playwright 时不影响其它接口启动
        const { chromium } = await import('playwright')
        // 某些部署环境（如带自定义 LD_LIBRARY_PATH 的容器）会用旧版 glib 覆盖系统库，
        // 导致 chromium 报 libatspi 符号缺失。这里剔除非常规路径，只保留系统库目录。
        const ldPath = (process.env.LD_LIBRARY_PATH || '')
          .split(':')
          .filter((p) => p && !p.includes('trae-cn-server') && !p.includes('node_modules'))
          .join(':')
        const childEnv: Record<string, string> = {}
        for (const [k, v] of Object.entries(process.env)) {
          if (v != null) childEnv[k] = v
        }
        if (ldPath) childEnv.LD_LIBRARY_PATH = ldPath
        else delete childEnv.LD_LIBRARY_PATH

        return await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
          env: childEnv,
        })
      } catch (err) {
        console.error('[compliance-crawler] Chromium 启动失败，本次巡检跳过自动抓取', err)
        browserPromise = null
        return null
      }
    })()
  }
  return browserPromise
}

async function politeWait(host: string): Promise<void> {
  const last = lastRequestAt.get(host) || 0
  const waitMs = MIN_INTERVAL_MS - (Date.now() - last)
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))
  lastRequestAt.set(host, Date.now())
}

/**
 * 复用同一个浏览器上下文：每次巡检要抓几十条规则，
 * 逐个 newContext 会白白多花 1~2 秒/页。页面级仍一页一关，避免内存堆积。
 */
async function getContext(): Promise<BrowserContext | null> {
  if (!contextPromise) {
    contextPromise = (async () => {
      const browser = await getBrowser()
      if (!browser) return null
      return browser.newContext({
        userAgent: USER_AGENT,
        locale: 'zh-CN',
        viewport: { width: 1440, height: 900 },
      })
    })()
  }
  return contextPromise
}

/** 渲染一个公开规则页，返回标题/正文/规则链接 */
export async function renderPublicPage(url: string): Promise<RenderedPage | null> {
  if (!crawlerEnabled() || !isAllowedUrl(url)) return null

  const host = new URL(url).hostname
  await politeWait(host)

  const context = await getContext()
  if (!context) return null
  const page = await context.newPage()

  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
    })
    const finalUrl = page.url()
    if (/login|passport|auth|captcha|verify/i.test(finalUrl) && finalUrl !== url) {
      return null
    }
    const status = response?.status() ?? 0
    if (status >= 400) return null

    // SPA 首屏后异步挂载：等 load + 主内容节点出现即可，不再死等 networkidle
    await page.waitForLoadState('load', { timeout: SETTLE_TIMEOUT_MS }).catch(() => undefined)
    await page
      .waitForSelector('article, main, .rule-detail, .rule-content, #content', { timeout: 5_000 })
      .catch(() => undefined)
    await page.waitForTimeout(1_000)

    const title = (await page.title()).replace(/\s+/g, ' ').trim()

    const extracted = await page.evaluate(() => {
      const pickSelectors = ['article', 'main', '.rule-detail', '.rule-content', '.content', '#content']
      let node: Element | null = null
      for (const sel of pickSelectors) {
        const el = document.querySelector(sel)
        if (el && (el.textContent || '').trim().length > 80) {
          node = el
          break
        }
      }
      const text = ((node || document.body) as HTMLElement).innerText || ''
      const links = Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        url: (a as HTMLAnchorElement).href,
        text: ((a.textContent || '').replace(/\s+/g, ' ').trim()),
      }))
      return { text, links }
    })

    const text = extracted.text.replace(/\s+/g, ' ').trim()
    return {
      url: finalUrl,
      title,
      text: text.slice(0, MAX_TEXT_LENGTH),
      links: extracted.links.filter((l) => l.text.length >= 6),
    }
  } catch (err) {
    console.error(`[compliance-crawler] 渲染失败 ${url}`, err)
    return null
  } finally {
    await page.close().catch(() => undefined)
  }
}

/** 正文有效性校验：太短说明是空壳或被拦截 */
export function isUsableContent(text: string): boolean {
  return text.replace(/\s+/g, '').length >= MIN_CONTENT_LENGTH
}

/**
 * 借助浏览器上下文调用站内 JSON 接口
 *
 * 部分平台（如快手）规则列表由前端 XHR 拉取，DOM 里没有详情链接，
 * 只能复用同一浏览器上下文请求其 gateway 接口。仍然只允许白名单域名。
 */
export async function postJsonViaBrowser<T = unknown>(
  pageUrl: string,
  apiUrl: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!crawlerEnabled() || !isAllowedUrl(pageUrl) || !isAllowedUrl(apiUrl)) return null

  await politeWait(new URL(pageUrl).hostname)

  const context = await getContext()
  if (!context) return null

  let page: Awaited<ReturnType<BrowserContext['newPage']>> | null = null
  try {
    // 先打开列表页建立同源会话（Cookie/Referer），再发接口请求
    page = await context.newPage()
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    await page.waitForTimeout(2_000)

    const response = await context.request.post(apiUrl, {
      data: body,
      headers: { 'Content-Type': 'application/json', Referer: pageUrl },
      timeout: NAV_TIMEOUT_MS,
    })
    if (!response.ok()) return null
    return (await response.json()) as T
  } catch (err) {
    console.error(`[compliance-crawler] 接口调用失败 ${apiUrl}`, err)
    return null
  } finally {
    await page?.close().catch(() => undefined)
  }
}
