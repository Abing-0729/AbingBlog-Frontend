export interface PostSummary {
  slug: string
  date: string
  title: string
  tag: string
  summary?: string
  url?: string
}

// 文章详情：展开列表项时按需拉取（含 Markdown 正文）
export interface PostDetail {
  title: string
  summary: string
  content: string
  cover: string
  url: string
}

export interface ProjectSummary {
  slug: string
  name: string
  detail: string
  stack: string
  githubUrl?: string
  demoUrl?: string
}

// —— 友链（对应后端 friend_links 表，前台与"我的友链"共用一套结构）——

// 审核状态机：0 待审核 → 管理员置 1 上架 / 2 驳回；访客修改后打回 0
export type FriendStatus = 0 | 1 | 2

export interface FriendLink {
  id: number
  name: string
  avatar: string
  url: string
  description: string
  status: FriendStatus
  sort: number
  owner_id: string
  created_at: string
  updated_at: string
}

// 提交/编辑友链的请求体（status 后端忽略，由审核决定）
export interface FriendLinkInput {
  name: string
  avatar: string
  url: string
  description: string
  sort: number
  status: FriendStatus
}
