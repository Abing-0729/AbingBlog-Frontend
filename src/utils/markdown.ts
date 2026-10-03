// 极简、XSS 安全的 Markdown 渲染器：先把所有文本做 HTML 转义，再做少量结构化规则。
// 刻意保持小巧——只覆盖博客正文常用的标题/强调/行内代码/代码块/链接/列表/引用。

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 只允许 http/https/mailto 链接，阻止 javascript: 等危险协议
function safeHref(raw: string): string {
  const url = raw.trim()
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : '#'
}

// 表格：分隔行（由 - 与 : 组成，至少一个 -）
function isTableDivider(line: string): boolean {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()))
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

function renderTableRow(cells: string[], head: boolean): string {
  const tag = head ? 'th' : 'td'
  return `<tr>${cells.map((c) => `<${tag}>${renderInline(c)}</${tag}>`).join('')}</tr>`
}

function renderInline(text: string): string {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
      `<a href="${safeHref(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`)
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let paragraph: string[] = []
  let i = 0

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块（mermaid 渲染成 .mermaid 节点，由 renderMermaid 绘制）
    if (/^\s*```/.test(line)) {
      flushParagraph()
      const lang = line.trim().slice(3).trim().toLowerCase()
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }
      i += 1 // 跳过结束围栏
      const body = code.join('\n')
      out.push(lang === 'mermaid' ? `<div class="mermaid">${body}</div>` : `<pre><code>${escapeHtml(body)}</code></pre>`)
      continue
    }

    // 标题
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      i += 1
      continue
    }

    // 引用
    if (/^\s{0,3}>/.test(line)) {
      flushParagraph()
      const quote: string[] = []
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s{0,3}>\s?/, ''))
        i += 1
      }
      out.push(`<blockquote>${quote.map(renderInline).join('<br/>')}</blockquote>`)
      continue
    }

    // 无序列表
    if (/^\s{0,3}[-*+]\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && /^\s{0,3}[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s{0,3}[-*+]\s+/, ''))
        i += 1
      }
      out.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`)
      continue
    }

    // 有序列表
    if (/^\s{0,3}\d+[.)]\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && /^\s{0,3}\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s{0,3}\d+[.)]\s+/, ''))
        i += 1
      }
      out.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ol>`)
      continue
    }

    // 分隔线
    if (/^\s{0,3}(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph()
      out.push('<hr/>')
      i += 1
      continue
    }

    // 表格（表头行 + 分隔行 + 若干数据行）
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushParagraph()
      out.push(`<table><thead>${renderTableRow(splitTableRow(line), true)}</thead><tbody>`)
      i += 2
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        out.push(renderTableRow(splitTableRow(lines[i]), false))
        i += 1
      }
      out.push('</tbody></table>')
      continue
    }

    // 空行 → 段落分隔
    if (/^\s*$/.test(line)) {
      flushParagraph()
      i += 1
      continue
    }

    paragraph.push(line.trim())
    i += 1
  }
  flushParagraph()

  return out.join('\n')
}

// Mermaid：按需从 CDN 加载并渲染页面中的 .mermaid 节点，避免首屏引入大体积依赖。
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
let mermaidLoader: Promise<any> | null = null

function loadMermaid(): Promise<any> {
  if (!mermaidLoader) {
    mermaidLoader = import(/* @vite-ignore */ MERMAID_URL).then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false })
      return mermaid
    })
  }
  return mermaidLoader
}

export async function renderMermaid(): Promise<void> {
  if (!document.querySelector('.mermaid')) return
  try {
    const mermaid = await loadMermaid()
    await mermaid.run({ nodes: Array.from(document.querySelectorAll('.mermaid')) })
  } catch {
    // 加载失败时保留原始文本，不影响正文阅读。
  }
}
