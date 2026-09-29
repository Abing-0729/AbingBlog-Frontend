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

    // 围栏代码块
    if (/^\s*```/.test(line)) {
      flushParagraph()
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i])
        i += 1
      }
      i += 1 // 跳过结束围栏
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
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
