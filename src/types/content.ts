export interface PostSummary {
  slug: string
  date: string
  title: string
  tag: string
  summary?: string
}

export interface ProjectSummary {
  slug: string
  name: string
  detail: string
  stack: string
  githubUrl?: string
  demoUrl?: string
}
