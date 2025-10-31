<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

//---------新增部分---------
<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

// 啟動時自動載入 localStorage 中的 token
const auth = useAuthStore()
onMounted(() => {
  auth.initializeAuth()
})
</script>
//---------新增部分---------s

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
}

#__nuxt {
  height: 100%;
}
</style>
