import { siteConfig } from '../config/site'

// 访客身份与设备识别。
// - 身份：localStorage 里的 UUID（清缓存才换人），对应后端 visit_logs.visitor_key
// - 设备：直接在浏览器端解析 navigator.userAgent，拼成 "iPhone · iOS 17 · Safari"
//   这样的短串，通过 X-Visitor-Device 头传给后端——Go 端不用引 UA 解析库
// - 传输：installVisitorHeaders() 包装 window.fetch，对 API 请求自动附加
//   X-Visitor-ID / X-Visitor-Device / X-Visitor-Name 三个头，调用处零改动

const VISITOR_ID_KEY = 'abing_visitor_id'
const VISITOR_NAME_KEY = 'abing_visitor_name'

export function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}

// 访客填过昵称（比如留言用的名字）就带上，后台看到的是人名而不是一串哈希
export function getVisitorName(): string | null {
  return localStorage.getItem(VISITOR_NAME_KEY)
}

export function setVisitorName(name: string): void {
  const trimmed = name.trim()
  if (trimmed) localStorage.setItem(VISITOR_NAME_KEY, trimmed.slice(0, 32))
}

// describeDevice 从 UA 字符串里抠出 设备/系统/浏览器 三个短标签。
// 只覆盖常见组合，认不出来就降级显示原始 UA 的前一段，不追求 100% 精确。
export function describeDevice(): string {
  const ua = navigator.userAgent
  const parts: string[] = []

  // 设备 + 系统
  const ios = /iPhone|iPad|iPod/.exec(ua)
  const android = /Android\s([\d.]+)/.exec(ua)
  if (ios) {
    parts.push(ios[0])
    const os = /OS\s(\d+[_\d]*)/.exec(ua)
    if (os) parts.push(`iOS ${os[1].replace(/_/g, '.')}`)
  } else if (android) {
    // Android UA 里通常带真实机型： "...; Pixel 7; Android 13; ..."
    const model = /Android\s[\d.]+;\s([^;)]+?)(?:;\sBuild|\))/i.exec(ua)
    const modelText = model?.[1]?.trim()
    if (modelText && !/^(wv|K|Chrome|Mobile)/i.test(modelText)) parts.push(modelText)
    parts.push(`Android ${android[1]}`)
  } else if (/Windows NT 10/.test(ua)) {
    parts.push('Windows')
  } else if (/Macintosh/.test(ua)) {
    const os = /Mac OS X\s(\d+[_\d]*)/.exec(ua)
    parts.push(os ? `macOS ${os[1].replace(/_/g, '.')}` : 'macOS')
  } else if (/Linux/.test(ua)) {
    parts.push('Linux')
  }

  // 浏览器（按识别优先级，Edge/EdgeHTML 优先于 Chrome 内核）
  const browser =
    /Edg\/([\d.]+)/.exec(ua) ? 'Edge' :
    /Firefox\/([\d.]+)/.exec(ua) ? 'Firefox' :
    /Chrome\/([\d.]+)/.exec(ua) ? 'Chrome' :
    /Version\/([\d.]+).*Safari/.exec(ua) ? 'Safari' : ''
  if (browser) parts.push(browser)

  if (!parts.length) return ua.slice(0, 64)
  return parts.join(' · ').slice(0, 64)
}

// installVisitorHeaders 包装 window.fetch：凡是指向后端 API 的请求
// 自动附加访客身份头。放 main.ts 里装一次，全站生效。
// 注意：这三个是自定义头，跨域时浏览器会先发 OPTIONS 预检，
// 后端 CORS 中间件的 Allow-Headers 必须放行它们。
export function installVisitorHeaders(): void {
  const originalFetch = window.fetch.bind(window)
  const marker = siteConfig.apiBaseUrl

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: string
    if (typeof input === 'string') url = input
    else if (input instanceof URL) url = input.href
    else url = input.url

    const isApiRequest = new URL(url, window.location.origin).pathname.startsWith(marker)
    if (!isApiRequest) return originalFetch(input, init)

    const headers = new Headers(init?.headers)
    headers.set('X-Visitor-ID', getVisitorId())
    headers.set('X-Visitor-Device', describeDevice())
    const name = getVisitorName()
    if (name) headers.set('X-Visitor-Name', name)

    // init 里只覆盖 headers：字符串入参时其余字段走 init（本来就有）；
    // Request 入参时 method/body 等字段按 spec 从 Request 继承
    const nextInit: RequestInit = { ...(init ?? {}), headers }
    return originalFetch(input, nextInit)
  }
}
