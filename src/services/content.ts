import { siteConfig } from '../config/site'
import { mockPosts, mockProjects } from '../data/mock'
import type { PostSummary, ProjectSummary } from '../types/content'

export interface ContentService {
  listPosts(): Promise<PostSummary[]>
  listProjects(): Promise<ProjectSummary[]>
}

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

interface ArticleListData {
  list: Array<{
    id: number
    title: string
    summary: string
    published_at: string
    category?: { name: string }
    tags?: Array<{ name: string }>
  }>
}

interface ProjectListData {
  list: Array<{
    slug: string
    name: string
    detail: string
    stack: string
    github_url?: string
    demo_url?: string
  }>
}

export const mockContentService: ContentService = {
  async listPosts() { return mockPosts },
  async listProjects() { return mockProjects },
}

export function createApiContentService(fetcher: typeof fetch = fetch): ContentService {
  async function get<T>(path: string): Promise<T> {
    const response = await fetcher(`${siteConfig.apiBaseUrl}${path}`)
    if (!response.ok) throw new Error(`API request failed: ${response.status}`)
    const payload = await response.json() as ApiEnvelope<T>
    if (payload.code !== 0) throw new Error(payload.message)
    return payload.data
  }
  return {
    async listPosts() {
      const data = await get<ArticleListData>('/articles?page=1&page_size=10')
      return data.list.map((article) => ({
        slug: String(article.id),
        date: article.published_at?.slice(0, 10).replaceAll('-', '.') ?? '',
        title: article.title,
        tag: article.category?.name ?? article.tags?.[0]?.name ?? 'NOTE',
        summary: article.summary,
      }))
    },
    async listProjects() {
      const data = await get<ProjectListData>('/projects?page=1&page_size=10')
      return data.list.map((project) => ({
        slug: project.slug,
        name: project.name,
        detail: project.detail,
        stack: project.stack,
        githubUrl: project.github_url,
        demoUrl: project.demo_url,
      }))
    },
  }
}

// 根据 VITE_USE_MOCK 开关选择数据来源：true 用 mock，false 调后端。
export const contentService: ContentService = siteConfig.useMockData
  ? mockContentService
  : createApiContentService()
