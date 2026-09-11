<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { siteConfig } from './config/site'
import { mockPosts, mockProjects } from './data/mock'

type Section = 'home' | 'posts' | 'projects' | 'about' | 'settings'

const inArcade = ref(true)
const booting = ref(false)
const arcadeReady = ref(false)
const current = ref<Section>('home')
const command = ref('')
const commandLog = ref<string[]>(['$ ls', 'about/  posts/  projects/  notes/  archive/', ''])
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
const startRecorded = ref(false)
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
  { id: 'home', label: 'home', command: 'cd ~' },
  { id: 'posts', label: 'posts', command: 'cd posts' },
  { id: 'projects', label: 'projects', command: 'cd projects' },
  { id: 'about', label: 'about', command: 'cat about.md' },
]

const promptPath = computed(() => current.value === 'home' ? '~' : `~/${current.value}`)

async function enterSystem() {
  if (booting.value || !arcadeReady.value) return
  booting.value = true
  if (!startRecorded.value) {
    startRecorded.value = true
    try {
      const response = await fetch(`${siteConfig.apiBaseUrl}/visits/start`, { method: 'POST' })
      const payload = await response.json() as { code: number; data?: { start_count: number } }
      if (response.ok && payload.code === 0 && payload.data) startCount.value = payload.data.start_count
    } catch {
      startCount.value += 1
    }
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
    const response = await fetch(`${siteConfig.apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUsername.value, password: adminPassword.value }),
    })
    const payload = await response.json() as { code: number; message: string; data?: { token: string; expires_in: number } }
    if (!response.ok || payload.code !== 0 || !payload.data?.token) throw new Error(payload.message || '登录失败')
    localStorage.setItem('abing_access_token', payload.data.token)
    localStorage.setItem('abing_access_token_expires_at', String(Date.now() + payload.data.expires_in * 1000))
    adminLoginOpen.value = false
    inArcade.value = false
    current.value = 'home'
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally {
    loggingIn.value = false
  }
}

function navigate(section: Section) {
  current.value = section
  if (section !== 'settings') commandLog.value.push(`$ ${sections.find((item) => item.id === section)?.command ?? 'settings'}`)
}

function submitCommand() {
  const raw = command.value.trim().toLowerCase()
  if (!raw) return
  commandLog.value.push(`$ ${command.value}`)
  command.value = ''

  if (raw === 'help') commandLog.value.push('commands: home, posts, projects, about, clear, settings')
  else if (raw === 'clear') commandLog.value = []
  else if (raw === 'home' || raw === 'cd ~') navigate('home')
  else if (raw.includes('post')) navigate('posts')
  else if (raw.includes('project')) navigate('projects')
  else if (raw.includes('about')) navigate('about')
  else if (raw.includes('setting')) navigate('settings')
  else commandLog.value.push(`command not found: ${raw}. try "help"`)
}

function replayIntro() {
  inArcade.value = true
  arcadeReady.value = false
  booting.value = false
  startRecorded.value = false
  controlFeedback.value = 'SYSTEM READY'
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
  <main class="site-shell" :class="{ 'no-motion': !motion }" :style="{ '--terminal-size': `${fontSize}px` }">
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
                <h1 id="arcade-title">{{ screenCopies[screenCopyIndex].title }}<br />PLAYER {{ String(startCount).padStart(3, '0') }}</h1>
                <p class="screen-subtitle">{{ screenCopies[screenCopyIndex].subtitle }}</p>
                <button class="start-button" type="button" @click="enterSystem">
                  <span class="button-mark">▶</span>
                  {{ booting ? 'INITIALIZING...' : 'PRESS START' }}
                </button>
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
      <aside class="rail" aria-label="Primary navigation">
        <a class="rail-logo" href="#" title="Go home" @click.prevent="navigate('home')">A<span>/</span></a>
        <nav>
          <button v-for="section in sections" :key="section.id" :class="{ active: current === section.id }" type="button" :title="section.label" @click="navigate(section.id)">
            <span class="nav-index">0{{ sections.indexOf(section) + 1 }}</span><span>{{ section.label }}</span>
          </button>
        </nav>
        <button class="rail-settings" :class="{ active: current === 'settings' }" type="button" title="Display settings" @click="navigate('settings')">◎</button>
      </aside>

      <div class="terminal-main">
        <header class="terminal-topbar">
          <div class="crumb"><span class="live-dot"></span> abing@blog:<b>{{ promptPath }}</b>$</div>
          <div class="topbar-actions"><span>UTC+8</span><span>SYS ONLINE</span><button type="button" title="Replay arcade intro" @click="replayIntro">↗</button></div>
        </header>

        <div class="terminal-scroll">
          <div class="content-column">
            <div class="terminal-intro">
              <p>ABING OS 0.1.0 <span>linux / x86_64</span></p>
              <p>Welcome back. Type <button type="button" @click="command = 'help'; submitCommand()">help</button> for available commands.</p>
            </div>

            <section v-if="current === 'home'" class="home-view">
            <div class="home-heading"><p class="eyebrow">CURRENT DIRECTORY</p><h2>FIELD NOTES</h2><p>Building systems, interfaces and small things worth keeping.</p></div>
            <div class="feature-grid">
              <article class="feature-note large-note" @click="navigate('posts')"><span class="note-label">LATEST / 2026.09.06</span><h3>把个人博客做成<br />一个可阅读的系统</h3><p>关于克制的交互、内容优先，以及为什么入口不该抢走文章的注意力。</p><span class="note-link">READ ENTRY ↗</span></article>
              <article class="feature-note status-note"><span class="note-label">NOW</span><dl><div><dt>BUILDING</dt><dd>AbingBlog</dd></div><div><dt>STACK</dt><dd>Go / Vue / MySQL</dd></div><div><dt>LISTENING</dt><dd>Deep Focus</dd></div></dl></article>
            </div>
            <div class="directory-list"><p class="eyebrow">INDEX</p><button v-for="section in sections.slice(1)" :key="section.id" type="button" @click="navigate(section.id)"><span>{{ section.label }}/</span><small>{{ section.command }}</small><b>↗</b></button></div>
            </section>

            <section v-else-if="current === 'posts'" class="list-view"><div class="view-title"><p class="eyebrow">DIRECTORY / POSTS</p><h2>WRITING</h2><span>{{ mockPosts.length.toString().padStart(2, '0') }} ENTRIES</span></div><article v-for="post in mockPosts" :key="post.slug" class="list-row"><time>{{ post.date }}</time><h3>{{ post.title }}</h3><span>{{ post.tag }}</span><button type="button" title="Open post">↗</button></article></section>

            <section v-else-if="current === 'projects'" class="list-view"><div class="view-title"><p class="eyebrow">DIRECTORY / PROJECTS</p><h2>SELECTED WORK</h2><span>{{ mockProjects.length.toString().padStart(2, '0') }} REPOSITORIES</span></div><article v-for="project in mockProjects" :key="project.slug" class="project-row"><div><h3>{{ project.name }}</h3><p>{{ project.detail }}</p></div><span>{{ project.stack }}</span><button type="button" title="Open repository">↗</button></article></section>

            <section v-else-if="current === 'about'" class="about-view"><p class="eyebrow">FILE / ABOUT.MD</p><h2>HELLO, I'M<br />ABING.</h2><div><p>I am a developer interested in dependable backend systems and calm, precise interfaces.</p><p>This is where I document the work: what I am making, how the pieces fit, and the lessons that survive the first implementation.</p><a href="mailto:hello@example.com">hello@example.com ↗</a></div></section>

            <section v-else class="settings-view"><div class="view-title"><p class="eyebrow">SYSTEM / DISPLAY</p><h2>SETTINGS</h2></div><label class="setting-row"><span>SCANLINES</span><input v-model="scanlines" type="checkbox" /><i></i></label><label class="setting-row"><span>ANIMATION</span><input v-model="motion" type="checkbox" /><i></i></label><label class="setting-row range-row"><span>FONT SIZE <b>{{ fontSize }}PX</b></span><input v-model="fontSize" type="range" min="13" max="19" /></label><button class="reset-intro" type="button" @click="replayIntro">REPLAY STARTUP SEQUENCE</button></section>
          </div>
          <aside class="command-panel" aria-label="Command output">
            <div class="command-panel-head"><span>COMMAND OUTPUT</span><i></i></div>
            <div class="command-log" aria-live="polite"><p v-for="(line, index) in commandLog" :key="index">{{ line }}</p></div>
            <div class="command-panel-foot"><span>LAST ACTION</span><b>{{ current.toUpperCase() }}</b></div>
          </aside>
        </div>
        <form class="command-bar" @submit.prevent="submitCommand"><span>abing@blog:{{ promptPath }}$</span><input v-model="command" aria-label="Terminal command" autocomplete="off" placeholder="type a command" /><b></b></form>
      </div>
    </section>
  </main>
</template>
