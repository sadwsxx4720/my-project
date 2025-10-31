<template>
  <div class="main-layout">
    <el-container>
      <el-header class="main-header">
        <div class="header-content">
          <div class="left">
            <h1>金鑰管理平台</h1> 
          </div>
          <div class="right">
            <el-select
              v-if="auth.isAuthenticated && userCodenames && userCodenames.length > 0" 
              v-model="selectedCodenameModel"
              placeholder="選擇專案"
              size="small"
              style="width: 350px; margin-right: 15px;" 
              filterable
            >
              <el-option
                v-for="code in userCodenames"
                :key="code"
                :label="code"
                :value="code"
              />
            </el-select>

            <el-dropdown>
              <el-button type="primary">
                {{ auth.user?.username || 'User Name' }}
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

            <el-menu-item index="home"> <el-icon><House /></el-icon> <span>首頁</span> </el-menu-item>
            <el-menu-item index="dashboard"> <el-icon><Monitor /></el-icon> <span>儀表板</span> </el-menu-item>
            <el-sub-menu index="tool">
              <template #title> <el-icon><Key /></el-icon> <span>金鑰管理模組</span> </template>
              <el-menu-item index="tool1">金鑰清單</el-menu-item>
              <el-menu-item index="tool3">金鑰資訊圖表</el-menu-item>
              <el-menu-item index="tool4">金鑰輪替及更換</el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="account">
              <template #title> <el-icon><User /></el-icon> <span>帳號管理</span> </template>
              <el-menu-item index="account1">帳號管理列表</el-menu-item>
              <el-menu-item index="log1">帳號操作日誌</el-menu-item>
            </el-sub-menu>
            <el-menu-item index="settings"> <el-icon><Setting /></el-icon> <span>通知與提醒</span> </el-menu-item>
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
// --- Imports ---
import { ArrowDown, Monitor, Setting, House, User, Key} from '@element-plus/icons-vue' // 移除了 Tools, MostlyCloudy
import { computed } from 'vue' // *** 確保 computed 被引入 ***
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus';

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// --- Computed Properties ---
const activeMenu = computed(() => {
  const path = route.path
  if (path === '/') return 'home'
  if (path === '/dashboard') return 'dashboard'
  if (path.startsWith('/tools/')) { const toolIndex = path.split('/')[2]; if (toolIndex) return toolIndex; }
  if (path.startsWith('/account')) return 'account1'
  if (path.startsWith('/log')) return 'log1'
  if (path === '/settings') return 'settings'
  return ''
})
// *** 新增：從 Store 獲取 Codenames ***
const userCodenames = computed(() => auth.availableCodename);
// *** 新增：為 v-model 創建 computed setter/getter ***
const selectedCodenameModel = computed({
    get: () => auth.currentSelectedCodename, // 讀取 store getter
    set: (value) => {
        if (value && value !== auth.currentSelectedCodename) { // 僅在值改變時調用 action
             auth.setSelectedCodename(value); // 調用 store action 更新
        }
    }
});


// --- Methods ---
const handleLogout = async () => {
  const username = auth.user?.username;
  const savedToken = auth.token; // 使用 store 中的 token

  if (username && savedToken) {
    try {
      console.log(`Calling logout API (GET) for user: ${username}`);
      await axios.get('http://localhost:8000/jwt/logout', {
        headers: { Authorization: `Bearer ${savedToken}` },
        params: { username: username }
      });
      console.log('Backend logout successful.');
    } catch (apiErr: any) {
      console.error('呼叫登出 API 時發生錯誤:', apiErr.response?.data || apiErr.message || apiErr);
    }
  } else { console.warn('無法呼叫登出 API：缺少 username 或 token'); }

  try {
    console.log('Executing frontend logout (auth.logout())...');
    await auth.logout();
    console.log('Frontend logout complete.');
  } catch (storeErr) {
    console.error('前端登出 (auth.logout) 失敗：', storeErr);
    ElMessage.error('登出過程中發生錯誤，請重試');
    if (typeof window !== 'undefined') localStorage.removeItem('auth_token');
    auth.$reset();
    router.push('/login');
  }
}
const handleMenuSelect = (index: string) => {
  switch (index) {
    case 'home': router.push('/'); break
    case 'dashboard': router.push('/dashboard'); break
    case 'account1': router.push('/account'); break
    case 'log1': router.push('/log'); break
    case 'tool1': router.push('/tools/tool1'); break
    case 'tool3': router.push('/tools/tool3'); break
    case 'tool4': router.push('/tools/tool4'); break
    case 'settings': router.push('/settings'); break
  }
}

// --- Lifecycle ---
// (可選) 可以在佈局掛載時觸發一次 auth store 的初始化 (如果 App.vue 沒有做)
// onMounted(() => {
//     if (!auth.isAuthenticated && localStorage.getItem('auth_token')) { // 使用 getter
//          console.log("Layout mounted, attempting to initialize auth...");
//          auth.initializeAuth();
//     }
// });
</script>

<style> /* 使用全局樣式 */
/* --- 基礎和滾動控制 --- (保持不變) */
html, body { height: 100%; margin: 0; padding: 0; overflow: hidden !important; }
#__nuxt, .main-layout, .el-container { height: 100%; }
/* --- 結束 --- */

/* --- Header --- (保持不變) */
.main-header {
  background-color: #fff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: fixed; top: 0; left: 0; width: 100%; height: 60px;
  z-index: 1001; padding: 0;
}
.header-content {
  max-width: 100%; height: 100%; display: flex;
  justify-content: space-between; align-items: center; padding: 0 20px;
}
.left h1 { margin: 0; font-size: 1.5em; color: #303133; }
.right { display: flex; align-items: center; } /* *** 確認 flex alignment *** */

/* --- Sidebar --- (保持不變) */
.main-sidebar {
  background-color: #fff; border-right: 1px solid #e6e6e6;
  position: fixed; left: 0; top: 60px; width: 220px;
  height: calc(100vh - 60px); z-index: 1000; overflow-y: auto;
  overflow-x: hidden; padding-bottom: 20px; box-sizing: border-box;
}
.main-menu { border-right: none; }

/* --- Main Content --- (保持不變) */
.main-content {
  margin-left: 220px; background-color: #f5f7fa;
  height: calc(100vh - 60px); overflow-y: auto !important;
  box-sizing: border-box !important; margin-top: 60px;
  /* padding: 20px !important; */ /* Padding 移至各頁面 */
}

/* --- 圖標樣式 --- (保持不變) */
.el-menu-item [class^="el-icon"], .el-sub-menu [class^="el-icon"] {
  margin-right: 5px; width: 24px; text-align: center; font-size: 18px;
}
</style>