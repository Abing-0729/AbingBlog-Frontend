<script setup lang="ts">
import { ref } from 'vue'
import ArticlePanel from './ArticlePanel.vue'
import CategoryPanel from './CategoryPanel.vue'
import TagPanel from './TagPanel.vue'
import ProjectPanel from './ProjectPanel.vue'

const emit = defineEmits<{ logout: []; back: [] }>()

type AdminTab = 'articles' | 'categories' | 'tags' | 'projects'
const tabs: { id: AdminTab; label: string }[] = [
  { id: 'articles', label: '文章' },
  { id: 'categories', label: '分类' },
  { id: 'tags', label: '标签' },
  { id: 'projects', label: '项目' },
]
const tab = ref<AdminTab>('articles')

// 任一面板收到 401（token 过期/非法）→ 交给 App.vue 清 token 回登录
function onAuthExpired() {
  emit('logout')
}
</script>

<template>
  <main class="admin-shell">
    <header class="admin-topbar">
      <span class="admin-title">ABING <i></i> 后台管理</span>
      <nav class="admin-tabs" aria-label="后台栏目">
        <button
          v-for="item in tabs"
          :key="item.id"
          :class="{ active: tab === item.id }"
          type="button"
          @click="tab = item.id"
        >{{ item.label }}</button>
      </nav>
      <div class="admin-topbar-actions">
        <button type="button" title="返回公开站点" @click="emit('back')">← 返回站点</button>
        <button class="logout-btn" type="button" @click="emit('logout')">退出登录</button>
      </div>
    </header>

    <ArticlePanel v-if="tab === 'articles'" @auth-expired="onAuthExpired" />
    <CategoryPanel v-else-if="tab === 'categories'" @auth-expired="onAuthExpired" />
    <TagPanel v-else-if="tab === 'tags'" @auth-expired="onAuthExpired" />
    <ProjectPanel v-else @auth-expired="onAuthExpired" />
  </main>
</template>
