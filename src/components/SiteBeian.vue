<script setup lang="ts">
import { siteConfig } from '../config/site'
</script>

<template>
  <a class="beian-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{{ siteConfig.icp }}</a>
  <a class="beian-link" href="https://beian.mps.gov.cn/" target="_blank" rel="noopener noreferrer">
    <svg class="beian-shield" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.2 2 3.6v3.9c0 3.4 2.6 6 6 7.3 3.4-1.3 6-3.9 6-7.3V3.6L8 1.2Z" fill="#c8102e" />
      <text x="8" y="11.6" text-anchor="middle" font-size="6.4" font-weight="700" fill="#fff">公</text>
    </svg>
    <span>{{ siteConfig.gongan }}</span>
  </a>
</template>
