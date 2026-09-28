import { siteConfig } from '../config/site'
import type { FriendLink, FriendLinkInput } from '../types/content'

// 友链独立 service，不走 contentService 的原因：
// contentService 在模块加载时就捕获了 fetch 引用（main.ts 安装访客头包装之前），
// /friend-links/mine 系列接口需要 X-Visitor-ID 头，所以这里每次调用都取全局 fetch
// （调用时 window.fetch 已是包装版，自动带访客身份）。

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // 不写成 const f = fetch：默认参数/局部变量都会在绑定时机捕获引用
  const response = await fetch(`${siteConfig.apiBaseUrl}${path}`, init)
  let payload: ApiEnvelope<T>
  try {
    payload = await response.json() as ApiEnvelope<T>
  } catch {
    throw new Error(`API request failed: ${response.status}`)
  }
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || `API request failed: ${response.status}`)
  }
  return payload.data as T
}

interface FriendLinkListData {
  list: FriendLink[]
}

function jsonBody(body: unknown, method: 'POST' | 'PUT' = 'POST'): RequestInit {
  return { method, body: JSON.stringify(body) }
}

export const friendLinkService = {
  // 前台列表：只含已上架的，无需访客标识
  listApproved(): Promise<FriendLink[]> {
    return request<FriendLinkListData>('/friend-links').then((data) => data.list ?? [])
  },

  // 我的友链：含待审核/已驳回，身份由 fetch 包装自动带 X-Visitor-ID
  listMine(): Promise<FriendLink[]> {
    return request<FriendLinkListData>('/friend-links/mine').then((data) => data.list ?? [])
  },

  create(input: FriendLinkInput): Promise<FriendLink> {
    return request<FriendLink>('/friend-links/mine', jsonBody(input))
  },

  update(id: number, input: FriendLinkInput): Promise<FriendLink> {
    return request<FriendLink>(`/friend-links/mine/${id}`, jsonBody(input, 'PUT'))
  },

  remove(id: number): Promise<void> {
    return request<null>(`/friend-links/mine/${id}`, { method: 'DELETE' }).then(() => undefined)
  },
}
