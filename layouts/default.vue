<template>
  <div class="main-layout">
    <el-container>
      <el-header class="main-header">
        <div class="header-content">
          <div class="left">
            <h1>RD3 Cloud Tool</h1>
          </div>
          <div class="right">
            <el-dropdown>
              <el-button type="primary">
                User Name
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="handleLogout">登出</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>
      
      <el-container class="main-container">
        <el-aside width="220px" class="main-sidebar">
          <el-menu
            :default-active="activeMenu"
            class="main-menu"
            @select="handleMenuSelect"
          >
            <el-menu-item index="home">
              <el-icon><House /></el-icon>
              <span>首頁</span>
            </el-menu-item>
            <el-menu-item index="dashboard">
              <el-icon><Monitor /></el-icon>
              <span>儀表板</span>
            </el-menu-item>
            <el-sub-menu index="tools">
              <template #title>
                <el-icon><Tools /></el-icon>
                <span>金鑰管理模組</span>
              </template>
              <el-menu-item index="tool1">金鑰清單</el-menu-item>
              <el-menu-item index="tool2">金鑰詳細資訊</el-menu-item>
              <el-menu-item index="tool3">金鑰輪替管理</el-menu-item>
            </el-sub-menu>
            <el-menu-item index="settings">
              <el-icon><Setting /></el-icon>
              <span>設定</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        
        <el-main class="main-content">
          <slot />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, Monitor, Tools, Setting, House } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'   // 引入 Pinia store


const router = useRouter()
const route = useRoute() 
const auth = useAuthStore() //取得 auth store 實例


// 根據當前路由設置活動菜單項
const activeMenu = computed(() => {
  const path = route.path
  if (path === '/') return 'home'
  if (path === '/dashboard') return 'dashboard'
  if (path.startsWith('/tools/')) return path.substring(7)
  if (path === '/settings') return 'settings'
  return ''
})

/*const handleLogout = () => {
  // TODO: 實作登出邏輯
  // 登出方法
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
    router.push('/login')
  }*/

// ✅ 登出事件
const handleLogout = async () => {
  try {
    await auth.logout() // 呼叫 Pinia 中的 logout()
  } catch (err) {
    console.error('登出失敗：', err)
  }
}
  
const handleMenuSelect = (index: string) => {
  switch (index) {
    case 'home':
      router.push('/')
      break
    case 'dashboard':
      router.push('/dashboard')
      break
    case 'tool1':
      router.push('/tools/tool1')
      break
    case 'tool2':
      router.push('/tools/tool2')
      break
    case 'tool3':
      router.push('/tools/tool3')
      break
    case 'settings':
      router.push('/settings')
      break
  }
}
</script>

<style scoped>
.main-layout {
  min-height: 100vh;
}

.main-header {
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: fixed;
  width: 100%;
  z-index: 1000;
  padding: 0;
}

.header-content {
  max-width: 100%;
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}

.left h1 {
  margin: 0;
  font-size: 1.5em;
  color: #303133;
}

.main-container {
  padding-top: 60px;
  height: calc(100vh - 60px);
}

.main-sidebar {
  background-color: #fff;
  border-right: 1px solid #e6e6e6;
  height: 100%;
  position: fixed;
  left: 0;
  top: 60px;
}

.main-menu {
  border-right: none;
}

.main-content {
  margin-left: 220px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.el-menu-item [class^="el-icon"] {
  margin-right: 5px;
  width: 24px;
  text-align: center;
  font-size: 18px;
}

.el-sub-menu [class^="el-icon"] {
  margin-right: 5px;
  width: 24px;
  text-align: center;
  font-size: 18px;
}
</style> 