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
    // Projects are mock-only until the backend adds GET /projects.
    listProjects: () => get<ProjectSummary[]>('/projects'),
  }
}
