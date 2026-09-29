<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { siteConfig } from './config/site'
import { contentService } from './services/content'
import { friendLinkService } from './services/friendLink'
import { clearSession } from './services/admin'
import AdminView from './admin/AdminView.vue'
import SiteBeian from './components/SiteBeian.vue'
import type { PostDetail, PostSummary, ProjectSummary, FriendLink } from './types/content'
import { renderMarkdown } from './utils/markdown'

type Section = 'home' | 'posts' | 'projects' | 'links' | 'about' | 'settings'

const inArcade = ref(true)
const isAdminMode = ref(false)
const booting = ref(false)
const arcadeReady = ref(false)
const current = ref<Section>('home')
const command = ref('')
const commandLog = ref<string[]>(['$ ls', 'about/  posts/  projects/', ''])
const scanlines = ref(true)
const motion = ref(true)
const fontSize = ref(15)
const staticCanvas = ref<HTMLCanvasElement | null>(null)
const coinDoor = ref<HTMLElement | null>(null)
const rollingCoin = ref<HTMLElement | null>(null)
const adminLoginOpen = ref(false)
const adminUsername = ref('')
const adminPassword = ref('')
const loginError = ref('')
const loggingIn = ref(false)
const controlFeedback = ref('SYSTEM READY')
const activeControl = ref('')
const startCount = ref(0)
const guestCount = ref(0)
const startRecorded = ref(false)
const countBump = ref(false)

// 安全解析响应 JSON：空响应或非 JSON 内容返回 null，避免 response.json() 抛 "Unexpected end of JSON input"。
async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

// 进入街机屏幕时读取总浏览量与独立访客数（只读，不自增）。
// distinct_users 是后端 visit_logs 聚合出的"来过多少人"，后端没实现时静默降级为 0。
async function loadVisitTotal() {
  try {
    const response = await fetch(`${siteConfig.apiBaseUrl}/visits`)
    if (!response.ok) return
    const payload = await readJson<{ code: number; data?: { start_count: number; distinct_users?: number } }>(response)
    if (payload && payload.code === 0 && payload.data) {
      startCount.value = payload.data.start_count
      guestCount.value = payload.data.distinct_users ?? 0
    }
  } catch {
    // 拿不到总量就保持 0，点 START 时仍会本地兜底 +1。
  }
}

const posts = ref<PostSummary[]>([])
const projects = ref<ProjectSummary[]>([])
const contentError = ref('')

// —— 友链 ——
const friendLinks = ref<FriendLink[]>([])      // 前台已上架
const myLinks = ref<FriendLink[]>([])          // 我的提交（含待审核/已驳回）
const linksError = ref('')                     // 我的友链区错误（前台列表失败并入 contentError）
const linksLoaded = ref(false)                 // 只在首次进入友链页时拉一次我的提交
const linkSaving = ref(false)
const editingLinkId = ref<number | null>(null)
const linkForm = ref({ name: '', url: '', avatar: '', description: '' })

const FRIEND_STATUS_TEXT: Record<number, string> = { 0: '待审核', 1: '已上架', 2: '已驳回' }

function friendStatusText(link: FriendLink): string {
  return FRIEND_STATUS_TEXT[link.status] ?? '未知'
}

function openLink(url: string) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

// 头像缺省：用站点名称首字符当徽标，避免空图位
function linkBadge(link: FriendLink): string {
  return (link.name.trim()[0] ?? '?').toUpperCase()
}

async function loadContent() {
  contentError.value = ''
  try {
    const [postList, projectList, linkList] = await Promise.all([
      contentService.listPosts(),
      contentService.listProjects(),
      friendLinkService.listApproved(),
    ])
    posts.value = postList
    projects.value = projectList
    friendLinks.value = linkList
  } catch (error) {
    contentError.value = error instanceof Error ? error.message : '内容加载失败'
  }
}

async function loadMyLinks() {
  linksError.value = ''
  try {
    myLinks.value = await friendLinkService.listMine()
  } catch (error) {
    linksError.value = error instanceof Error ? error.message : '我的友链加载失败'
  }
}

function resetLinkForm() {
  editingLinkId.value = null
  linkForm.value = { name: '', url: '', avatar: '', description: '' }
}

function editMyLink(link: FriendLink) {
  editingLinkId.value = link.id
  linkForm.value = {
    name: link.name,
    url: link.url,
    avatar: link.avatar,
    description: link.description,
  }
}

async function submitLink() {
  if (linkSaving.value) return
  const name = linkForm.value.name.trim()
  const url = linkForm.value.url.trim()
  if (!name || !url) {
    linksError.value = '站点名称和地址为必填项'
    return
  }
  linkSaving.value = true
  linksError.value = ''
  const input = {
    name,
    url,
    avatar: linkForm.value.avatar.trim(),
    description: linkForm.value.description.trim(),
    sort: 0,
    status: 0 as const, // 后端忽略该值，提交一律待审核
  }
  try {
    if (editingLinkId.value === null) await friendLinkService.create(input)
    else await friendLinkService.update(editingLinkId.value, input)
    resetLinkForm()
    await loadMyLinks()
  } catch (error) {
    linksError.value = error instanceof Error ? error.message : '提交失败，请稍后重试'
  } finally {
    linkSaving.value = false
  }
}

const confirmDeleteLinkId = ref<number | null>(null)

async function deleteMyLink() {
  const id = confirmDeleteLinkId.value
  if (id === null || linkSaving.value) return
  linkSaving.value = true
  linksError.value = ''
  try {
    await friendLinkService.remove(id)
    confirmDeleteLinkId.value = null
    if (editingLinkId.value === id) resetLinkForm()
    await loadMyLinks()
  } catch (error) {
    linksError.value = error instanceof Error ? error.message : '删除失败'
    confirmDeleteLinkId.value = null
  } finally {
    linkSaving.value = false
  }
}

// 项目列表：点击左侧展开主要内容，点击箭头跳转到项目链接（github 优先，其次 demo）。
const expandedProject = ref<string | null>(null)

function toggleProject(slug: string) {
  expandedProject.value = expandedProject.value === slug ? null : slug
}

function projectUrl(project: ProjectSummary) {
  return project.githubUrl ?? project.demoUrl ?? ''
}

function openProject(project: ProjectSummary) {
  const url = projectUrl(project)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

// 文章列表：点击左侧展开正文（按需拉取详情，缓存避免重复请求），点击箭头跳转到原文外链。
const expandedPost = ref<string | null>(null)
const postDetails = ref<Record<string, PostDetail>>({})
const postLoading = ref<Record<string, boolean>>({})
const postDetailError = ref('')

async function togglePost(slug: string) {
  if (expandedPost.value === slug) {
    expandedPost.value = null
    return
  }
  expandedPost.value = slug
  if (postDetails.value[slug]) return
  postLoading.value[slug] = true
  postDetailError.value = ''
  try {
    postDetails.value[slug] = await contentService.getPost(slug)
  } catch (error) {
    postDetailError.value = error instanceof Error ? error.message : '正文加载失败'
  } finally {
    postLoading.value[slug] = false
  }
}

function openPost(post: PostSummary) {
  if (post.url) window.open(post.url, '_blank', 'noopener,noreferrer')
}

const screenThemeIndex = ref(0)
const screenCopyIndex = ref(0)
const screenThemes = ['mono', 'amber', 'blue'] as const
const screenCopies = [
  { title: 'READY', subtitle: "a developer's field notes, projects and experiments" },
  { title: 'SYSTEM', subtitle: 'quiet tools, reliable systems, useful notes' },
  { title: 'FIELD', subtitle: 'building small things that survive first contact' },
]
let staticFrame = 0

function alignCoinToSlot() {
  const door = coinDoor.value
  const coin = rollingCoin.value
  const slot = door?.querySelector<HTMLElement>('.coin-return')
  if (!door || !coin || !slot) return

  // Measure the untransformed layout boxes so the final keyframe lands on the
  // actual slot, including responsive cabinet widths.
  const targetX = slot.offsetLeft + slot.offsetWidth / 2 - (coin.offsetLeft + coin.offsetWidth / 2)
  const targetY = slot.offsetTop + slot.offsetHeight / 2 - (coin.offsetTop + coin.offsetHeight / 2) - 2
  door.style.setProperty('--coin-target-x', `${targetX}px`)
  door.style.setProperty('--coin-target-y', `${targetY}px`)
}

const sections: { id: Section; label: string; command: string }[] = [
  { id: 'home', label: '首页', command: 'cd ~' },
  { id: 'posts', label: '文章', command: 'cd posts' },
  { id: 'projects', label: '项目', command: 'cd projects' },
  { id: 'links', label: '友链', command: 'cd links' },
  { id: 'about', label: '关于', command: 'cat about.md' },
]

const promptPath = computed(() => current.value === 'home' ? '~' : `~/${current.value}`)

async function enterSystem() {
  if (booting.value || !arcadeReady.value) return
  booting.value = true
  if (!startRecorded.value) {
    startRecorded.value = true
    try {
      const response = await fetch(`${siteConfig.apiBaseUrl}/visits/start`, { method: 'POST' })
      const payload = await readJson<{ code: number; data?: { start_count: number } }>(response)
      if (response.ok && payload && payload.code === 0 && payload.data) startCount.value = payload.data.start_count
      else startCount.value += 1
    } catch {
      startCount.value += 1
    }
    // 触发数字 +1 的弹跳动画。
    countBump.value = true
    window.setTimeout(() => { countBump.value = false }, 600)
  }
  controlFeedback.value = 'SYSTEM ENTERED'
  window.setTimeout(() => {
    inArcade.value = false
  }, motion.value ? 1000 : 0)
}

function openAdminLogin() {
  if (booting.value || !arcadeReady.value) return
  adminLoginOpen.value = true
  loginError.value = ''
}

function activateControl(control: 'joystick' | 'a' | 'b') {
  activeControl.value = control
  if (control === 'joystick') {
    screenThemeIndex.value = (screenThemeIndex.value + 1) % screenThemes.length
    controlFeedback.value = `${screenThemes[screenThemeIndex.value].toUpperCase()} CRT PROFILE`
  } else {
    screenCopyIndex.value = (screenCopyIndex.value + (control === 'a' ? 1 : screenCopies.length - 1)) % screenCopies.length
    controlFeedback.value = control === 'a' ? 'TEXT CHANNEL NEXT' : 'TEXT CHANNEL PREV'
  }
  window.setTimeout(() => { activeControl.value = '' }, 180)
}

async function loginAdmin() {
  if (!adminUsername.value || !adminPassword.value || loggingIn.value) return
  loggingIn.value = true
  loginError.value = ''
  try {
    const response = await fetch(`${siteConfig.apiBaseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUsername.value, password: adminPassword.value }),
    })
    // 后端只返回 token（无 expires_in），过期靠 admin 请求的 401 兜底
    const payload = await readJson<{ code: number; message: string; data?: { token: string } }>(response)
    if (!response.ok || !payload || payload.code !== 0 || !payload.data?.token) throw new Error(payload?.message || `登录失败 (${response.status})`)
    localStorage.setItem('abing_access_token', payload.data.token)
    adminLoginOpen.value = false
    isAdminMode.value = true
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally {
    loggingIn.value = false
  }
}

// 退出后台：清 token，回街机入口（replayIntro 会重拉访客总量）
function logoutAdmin() {
  clearSession()
  isAdminMode.value = false
  replayIntro()
}

// 返回公开站点：token 保留，之后想再进后台需重新走登录
function backToSite() {
  isAdminMode.value = false
  inArcade.value = false
  current.value = 'home'
}

function navigate(section: Section) {
  current.value = section
  if (section === 'links' && !linksLoaded.value) {
    linksLoaded.value = true
    loadMyLinks()
  }
  if (section !== 'settings') commandLog.value.push(`$ ${sections.find((item) => item.id === section)?.command ?? 'settings'}`)
}

function submitCommand() {
  const raw = command.value.trim().toLowerCase()
  if (!raw) return
  commandLog.value.push(`$ ${command.value}`)
  command.value = ''

  if (raw === 'help') commandLog.value.push('可用命令：home 首页 / posts 文章 / projects 项目 / links 友链 / about 关于 / settings 设置 / clear 清屏')
  else if (raw === 'clear') commandLog.value = []
  else if (raw === 'home' || raw === 'cd ~') navigate('home')
  else if (raw.includes('post')) navigate('posts')
  else if (raw.includes('project')) navigate('projects')
  else if (raw.includes('link') || raw.includes('friend')) navigate('links')
  else if (raw.includes('about')) navigate('about')
  else if (raw.includes('setting')) navigate('settings')
  else commandLog.value.push(`未找到命令：${raw}。试试 "help"`)
}

function replayIntro() {
  inArcade.value = true
  arcadeReady.value = false
  booting.value = false
  startRecorded.value = false
  controlFeedback.value = 'SYSTEM READY'
  loadVisitTotal()
  nextTick(() => {
    alignCoinToSlot()
    startStaticCanvas()
  })
  window.setTimeout(() => { arcadeReady.value = true }, 2050)
}

function startStaticCanvas() {
  window.cancelAnimationFrame(staticFrame)
  const canvas = staticCanvas.value
  const context = canvas?.getContext('2d')
  if (canvas && context) {
    canvas.width = 320
    canvas.height = 220
    const drawStatic = () => {
      const image = context.createImageData(canvas.width, canvas.height)
      const pixels = image.data
      for (let index = 0; index < pixels.length; index += 4) {
        const value = Math.random() * 255
        pixels[index] = value
        pixels[index + 1] = value
        pixels[index + 2] = value
        pixels[index + 3] = 255
      }
      context.putImageData(image, 0, 0)
      context.globalAlpha = 0.22
      context.fillStyle = Math.random() > 0.5 ? '#e8efe1' : '#111611'
      for (let line = 0; line < 7; line += 1) {
        context.fillRect(0, Math.random() * canvas.height, canvas.width, Math.random() * 3 + 1)
      }
      context.globalAlpha = 1
      if (!arcadeReady.value && motion.value) staticFrame = window.requestAnimationFrame(drawStatic)
    }
    drawStatic()
  }
}

onMounted(() => {
  loadContent()
  loadVisitTotal()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) motion.value = false
  nextTick(() => {
    alignCoinToSlot()
    startStaticCanvas()
  })
  window.addEventListener('resize', alignCoinToSlot)
  window.setTimeout(() => { arcadeReady.value = true }, motion.value ? 2050 : 0)
})

onBeforeUnmount(() => {
  window.cancelAnimationFrame(staticFrame)
  window.removeEventListener('resize', alignCoinToSlot)
})
</script>

<template>
  <AdminView v-if="isAdminMode" @logout="logoutAdmin" @back="backToSite" />
  <main v-else class="site-shell" :class="{ 'no-motion': !motion }" :style="{ '--terminal-size': `${fontSize}px` }">
    <section v-if="inArcade" class="arcade-entry" aria-labelledby="arcade-title">
      <div class="entry-noise"></div>
      <header class="entry-meta"><span>ABING SYSTEMS</span><span>EST. 2026</span></header>
      <div class="arcade-machine" :class="{ booting }">
        <div class="side-panel side-panel-left" aria-hidden="true"><span>ABING</span><i></i><small>NODE // 01</small></div>
        <div class="side-panel side-panel-right" aria-hidden="true"><span>INSERT<br />COIN</span><i></i><small>EST. 2026</small></div>
        <div class="machine-marquee"><span>ABING</span><small>DEVELOPER TERMINAL<br />PERSONAL COMPUTING UNIT</small><span>01</span></div>
        <div class="machine-body">
          <div class="speaker-grille speaker-left" aria-hidden="true"><i v-for="n in 21" :key="n"></i></div>
          <div class="speaker-grille speaker-right" aria-hidden="true"><i v-for="n in 21" :key="n"></i></div>
          <span class="cabinet-bolt bolt-one" aria-hidden="true"></span><span class="cabinet-bolt bolt-two" aria-hidden="true"></span>
          <div class="screen-bezel">
            <div class="arcade-screen" :class="`screen-theme-${screenThemes[screenThemeIndex]}`">
              <div class="screen-corners"></div>
              <div v-if="!arcadeReady" class="static-screen" aria-live="polite"><canvas ref="staticCanvas" class="static-canvas" aria-hidden="true"></canvas><div></div><p>COIN ACCEPTED</p><small>SYNCING CRT SIGNAL...</small></div>
              <template v-else>
                <p class="eyebrow">PERSONAL COMPUTING UNIT</p>
                <h1 id="arcade-title">{{ screenCopies[screenCopyIndex].title }}<br />PLAYER <span class="visit-count" :class="{ bump: countBump }">{{ String(startCount).padStart(3, '0') }}</span></h1>
                <p class="screen-subtitle">{{ screenCopies[screenCopyIndex].subtitle }}</p>
                <button class="start-button" type="button" @click="enterSystem">
                  <span class="button-mark">▶</span>
                  {{ booting ? 'INITIALIZING...' : 'PRESS START' }}
                </button>
                <p class="screen-visitors" aria-label="累计访客与启动次数">
                  GUESTS <b>{{ String(guestCount).padStart(3, '0') }}</b> · PLAYS <b>{{ String(startCount).padStart(3, '0') }}</b>
                </p>
                <p class="screen-status">{{ controlFeedback }} <span class="pulse-dot"></span></p>
              </template>
            </div>
          </div>
          <div class="control-deck">
            <button class="mechanical-stick" :class="{ active: activeControl === 'joystick' }" type="button" aria-label="Direction control" @click="activateControl('joystick')"><span class="stick-ball"></span><span class="stick-shaft"></span><span class="stick-collar"></span><span class="stick-base"></span><small>DIRECTION</small></button>
            <div class="deck-instruction" aria-hidden="true"><b>INPUT / 01</b><small>SELECT A PATH</small></div>
            <div class="control-buttons"><button class="control-button control-button-primary" :class="{ active: activeControl === 'a' }" type="button" aria-label="A control" @click="activateControl('a')"></button><button class="control-button" :class="{ active: activeControl === 'b' }" type="button" aria-label="B control" @click="activateControl('b')"></button><small aria-hidden="true">A / B</small></div>
            <div class="deck-label">ABING / NODE 01</div>
          </div>
          <div class="lower-cabinet">
            <div ref="coinDoor" class="coin-door" aria-hidden="true"><div ref="rollingCoin" class="rolling-coin"><span>1</span></div><span class="coin-return"></span><i></i><small>INSERT COIN</small><em></em></div>
            <div class="service-label" aria-hidden="true" @dblclick="openAdminLogin"><b>ABING SYSTEMS</b><span>MODEL A-01</span><small>NO SERVICEABLE PARTS INSIDE</small></div>
            <div class="ventilation" aria-hidden="true"><i v-for="n in 8" :key="n"></i></div>
          </div>
        </div>
        <div class="machine-foot"><span></span><i></i><span></span></div>
      </div>
      <p class="entry-instruction">ONE CREDIT REQUIRED · START FROM SCREEN</p>
      <div class="entry-beian"><SiteBeian /></div>
      <div v-if="adminLoginOpen" class="admin-login" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
        <button class="admin-login-close" type="button" aria-label="Close administrator login" @click="adminLoginOpen = false">×</button>
        <p class="eyebrow">SERVICE ACCESS / NODE 01</p>
        <h2 id="admin-login-title">ADMIN LOGIN</h2>
        <form @submit.prevent="loginAdmin">
          <label>USERNAME<input v-model="adminUsername" name="username" autocomplete="username" required /></label>
          <label>PASSWORD<input v-model="adminPassword" name="password" type="password" autocomplete="current-password" required /></label>
          <p v-if="loginError" class="login-error" role="alert">{{ loginError }}</p>
          <button class="admin-submit" type="submit" :disabled="loggingIn">{{ loggingIn ? 'AUTHENTICATING...' : 'CONNECT' }}</button>
        </form>
      </div>
    </section>

    <section v-else class="terminal-workspace" :class="{ 'with-scanlines': scanlines }">
      <aside class="rail" aria-label="主导航">
        <a class="rail-logo" href="#" title="返回首页" @click.prevent="navigate('home')">A<span>/</span></a>
        <nav>
          <button v-for="section in sections" :key="section.id" :class="{ active: current === section.id }" type="button" :title="section.label" @click="navigate(section.id)">
            <span class="nav-index">0{{ sections.indexOf(section) + 1 }}</span><span>{{ section.label }}</span>
          </button>
        </nav>
        <button class="rail-settings" :class="{ active: current === 'settings' }" type="button" title="显示设置" @click="navigate('settings')">◎</button>
      </aside>

      <div class="terminal-main">
        <header class="terminal-topbar">
          <div class="crumb"><span class="live-dot"></span> abing@blog:<b>{{ promptPath }}</b>$</div>
          <div class="topbar-actions"><span>UTC+8</span><span>online</span><button type="button" title="重播启动动画" @click="replayIntro">↗</button></div>
        </header>

        <div class="terminal-scroll">
          <div class="content-column">
            <div class="terminal-intro">
              <p>ABING OS 0.1.0 <span>linux / x86_64</span></p>
              <p>欢迎访问。输入 <button type="button" @click="command = 'help'; submitCommand()">help</button> 查看可用命令。</p>
            </div>

            <section v-if="current === 'home'" class="home-view">
            <div class="home-heading"><p class="eyebrow">当前目录</p><h2>最新笔记</h2><p>构建系统、界面、构思，以及值得留下的小东西。</p></div>
            
            <div class="feature-grid">
              <article class="feature-note large-note" @click="navigate('posts')"><span class="note-label">最新 / 2026.09.06</span><h3>把个人博客做成<br />一个可阅读的系统</h3><p>关于克制的交互、内容优先，以及为什么入口不该抢走文章的注意力。</p><span class="note-link">阅读全文 ↗</span></article>
              <article class="feature-note status-note"><span class="note-label">现在</span><dl><div><dt>在做</dt><dd>天池·欧莱雅赛题</dd></div><div><dt>技术栈</dt><dd>Go / Java / Vue / MySQL / redis /docker </dd></div><div><dt>在听</dt><dd>call of silence</dd></div></dl></article>
            </div>
            <div class="directory-list"><p class="eyebrow">索引</p><button v-for="section in sections.slice(1)" :key="section.id" type="button" @click="navigate(section.id)"><span>{{ section.label }}/</span><small>{{ section.command }}</small><b>↗</b></button></div>
            </section>

            <section v-else-if="current === 'posts'" class="list-view"><div class="view-title"><p class="eyebrow">目录 / 文章</p><h2>文章</h2><span>共 {{ posts.length }} 篇</span></div><p v-if="contentError" class="login-error" role="alert">{{ contentError }}</p><p v-else-if="!posts.length" class="eyebrow">暂无文章</p><article v-for="post in posts" :key="post.slug" class="post-row" :class="{ expanded: expandedPost === post.slug }"><div class="post-main" role="button" tabindex="0" :aria-expanded="expandedPost === post.slug" @click="togglePost(post.slug)" @keydown.enter.prevent="togglePost(post.slug)" @keydown.space.prevent="togglePost(post.slug)"><h3>{{ post.title }}</h3><p v-if="post.summary" class="post-summary">{{ post.summary }}</p></div><time class="post-date">{{ post.date }}</time><span class="post-tag">{{ post.tag }}</span><button class="post-link" type="button" :title="post.url ? '打开原文链接' : '暂无外链'" :aria-label="post.url ? '打开原文链接' : '暂无外链'" :disabled="!post.url" @click="openPost(post)">↗</button><div v-if="expandedPost === post.slug" class="post-detail"><p v-if="postLoading[post.slug]" class="post-detail-loading">加载正文…</p><p v-else-if="postDetailError" class="login-error" role="alert">{{ postDetailError }}</p><div v-else-if="postDetails[post.slug]" class="post-content" v-html="renderMarkdown(postDetails[post.slug]?.content ?? '')"></div></div></article></section>

            <section v-else-if="current === 'projects'" class="list-view"><div class="view-title"><p class="eyebrow">目录 / 项目</p><h2>项目</h2><span>共 {{ projects.length }} 个</span></div><article v-for="project in projects" :key="project.slug" class="project-row" :class="{ expanded: expandedProject === project.slug }"><div class="project-main" role="button" tabindex="0" :aria-expanded="expandedProject === project.slug" @click="toggleProject(project.slug)" @keydown.enter.prevent="toggleProject(project.slug)" @keydown.space.prevent="toggleProject(project.slug)"><h3>{{ project.name }}</h3><p>{{ project.detail }}</p></div><span>{{ project.stack }}</span><button class="project-link" type="button" :title="projectUrl(project) ? '打开项目链接' : '暂无链接'" aria-label="打开项目链接" :disabled="!projectUrl(project)" @click="openProject(project)">↗</button><div v-if="expandedProject === project.slug" class="project-detail"><p class="project-detail-desc">{{ project.detail }}</p><p class="project-detail-stack">{{ project.stack }}</p><div class="project-detail-links"><a v-if="project.githubUrl" :href="project.githubUrl" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a v-if="project.demoUrl" :href="project.demoUrl" target="_blank" rel="noopener noreferrer">演示 ↗</a></div></div></article></section>

            <section v-else-if="current === 'links'" class="links-view">
              <div class="view-title"><p class="eyebrow">目录 / 友链</p><h2>友链</h2><span>共 {{ friendLinks.length }} 个站点</span></div>
              <p v-if="contentError" class="login-error" role="alert">{{ contentError }}</p>
              <p v-else-if="!friendLinks.length" class="eyebrow">暂无友链，来做第一个交换链接的人</p>
              <div v-else class="link-grid">
                <a v-for="link in friendLinks" :key="link.id" class="link-card" :href="link.url" target="_blank" rel="noopener noreferrer">
                  <span class="link-avatar" aria-hidden="true">
                    <img v-if="link.avatar" :src="link.avatar" :alt="link.name" loading="lazy" referrerpolicy="no-referrer" @error="($event.target as HTMLImageElement).remove()" />
                    <b v-if="!link.avatar">{{ linkBadge(link) }}</b>
                  </span>
                  <span class="link-info">
                    <strong>{{ link.name }}</strong>
                    <small>{{ link.description || link.url }}</small>
                  </span>
                  <span class="link-go" aria-hidden="true">↗</span>
                </a>
              </div>

              <div class="link-mine">
                <div class="link-mine-head"><p class="eyebrow">我的提交 / MY LINKS</p><span>提交后需审核上架；修改会重新进入待审核</span></div>
                <form class="link-form" @submit.prevent="submitLink">
                  <label>站点名称<input v-model="linkForm.name" required maxlength="64" placeholder="比如：阿冰的小站" /></label>
                  <label>站点地址<input v-model="linkForm.url" required maxlength="500" type="url" placeholder="https://example.com" /></label>
                  <label>头像地址（可选）<input v-model="linkForm.avatar" maxlength="500" type="url" placeholder="https://.../avatar.png" /></label>
                  <label class="full">一句话简介（可选）<input v-model="linkForm.description" maxlength="255" placeholder="这个博客写点什么" /></label>
                  <div class="link-form-actions">
                    <button class="link-submit" type="submit" :disabled="linkSaving">{{ linkSaving ? '提交中…' : (editingLinkId === null ? '提交友链' : '保存修改') }}</button>
                    <button v-if="editingLinkId !== null" class="link-cancel" type="button" @click="resetLinkForm">取消编辑</button>
                  </div>
                </form>
                <p v-if="linksError" class="login-error" role="alert">{{ linksError }}</p>
                <p v-else-if="!myLinks.length" class="eyebrow">还没有提交过友链</p>
                <div v-else class="link-mine-list">
                  <div v-for="link in myLinks" :key="link.id" class="link-mine-row">
                    <div class="link-mine-main">
                      <strong>{{ link.name }}</strong>
                      <small>{{ link.url }}</small>
                    </div>
                    <span :class="['friend-status', `friend-status-${link.status}`]">{{ friendStatusText(link) }}</span>
                    <div class="link-mine-actions">
                      <button type="button" :disabled="linkSaving" @click="editMyLink(link)">编辑</button>
                      <button type="button" class="danger" :disabled="linkSaving" @click="confirmDeleteLinkId = link.id">删除</button>
                    </div>
                    <div v-if="confirmDeleteLinkId === link.id" class="confirm-bar" role="alert">
                      <span>确定删除友链 <b>「{{ link.name }}」</b>？</span>
                      <button type="button" :disabled="linkSaving" @click="deleteMyLink">确认删除</button>
                      <button class="keep" type="button" @click="confirmDeleteLinkId = null">取消</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section v-else-if="current === 'about'" class="about-view"><p class="eyebrow">文件 / ABOUT.MD</p><h2>你好，我是<br />阿滨.</h2><div><p>一个专注可靠后端系统与克制、精确界面的开发者。</p><p>这里记录我做的东西：正在构建什么、各个部分如何拼在一起，以及那些熬过许多第一版实现的教训。</p><p>好的建议·别的想法...</p><a href="mailto:2509094405@qq.com">2509094405@qq.com ↗</a><p><a href="https://github.com/bingege-0729" target="_blank" rel="noopener noreferrer">GitHub ↗</a></p></div></section>

            <section v-else class="settings-view"><div class="view-title"><p class="eyebrow">系统 / 显示</p><h2>设置</h2></div><label class="setting-row"><span>扫描线</span><input v-model="scanlines" type="checkbox" /><i></i></label><label class="setting-row"><span>动画</span><input v-model="motion" type="checkbox" /><i></i></label><label class="setting-row range-row"><span>字号 <b>{{ fontSize }}PX</b></span><input v-model="fontSize" type="range" min="13" max="19" /></label><button class="reset-intro" type="button" @click="replayIntro">重播启动动画</button></section>
          </div>
          <aside class="command-panel" aria-label="命令输出">
            <div class="command-panel-head"><span>Output</span><i></i></div>
            <div class="command-log" aria-live="polite"><p v-for="(line, index) in commandLog" :key="index">{{ line }}</p></div>
            <div class="command-panel-foot"><span>当前目录</span><b>{{ promptPath }}</b></div>
          </aside>
        </div>
        <form class="command-bar" @submit.prevent="submitCommand"><span>abing@blog:{{ promptPath }}$</span><input v-model="command" aria-label="终端命令" autocomplete="off" placeholder="输入命令" /><b></b></form>
        <footer class="site-footer"><SiteBeian /></footer>
      </div>
    </section>
  </main>
</template>
