<script setup lang="ts">
import { siteConfig } from '../config/site'
</script>

<template>
  <a class="beian-link" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">{{ siteConfig.icp }}</a>
  <a class="beian-link" href="https://beian.mps.gov.cn/" target="_blank" rel="noopener noreferrer">
    <img class="beian-shield" src="../assets/ghs.png" alt="公安备案徽标" />
    <span>{{ siteConfig.gongan }}</span>
  </a>
</template>
