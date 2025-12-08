<template>
  <div class="main-layout">
    <el-container>
      <!-- 頂部 Header -->
      <el-header class="main-header">
        <div class="header-content">
          <div class="left">
            <h1>金鑰管理平台</h1> 
          </div>
          <div class="right">
            <!-- 專案選擇器 -->
            <!-- 只要登入就顯示 -->
            <el-select
              v-if="auth.isAuthenticated" 
              v-model="selectedCodenameModel"
              placeholder="選擇專案"
              size="small"
              style="width: 350px; margin-right: 15px;" 
              filterable
            >
              <!-- Superuser 專屬選項：全部 -->
              <el-option
                v-if="auth.isSuperuser"
                label="全部專案"
                value="all"
              />

              <!-- 使用從 API 獲取的 projectList -->
              <el-option
                v-for="code in projectList"
                :key="code"
                :label="code"
                :value="code"
              />
            </el-select>

            <!-- 使用者下拉選單 -->
            <el-dropdown>
              <el-button type="primary">
                {{ auth.user?.username || 'User Name' }}
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item style="justify-content: center;" @click="handleLogout">登出</el-dropdown-item>
                  
                  <!-- 變更密碼：非 Superuser 才顯示 -->
                  <el-dropdown-item 
                    v-if="!auth.isSuperuser" 
                    style="justify-content: center;"
                    @click="changePassword"
                  >
                    變更密碼
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <el-container class="main-container"> 
        <!-- 左側邊欄 -->
        <el-aside width="220px" class="main-sidebar">
          <el-menu
            :default-active="activeMenu"
            class="main-menu"
            @select="handleMenuSelect"
          >
            <!-- 常用功能 -->
            <el-menu-item index="home"> <el-icon><House /></el-icon> <span>首頁</span> </el-menu-item>
            
            <!-- 【需求修改】儀表板：僅 Superuser 顯示 -->
            <el-menu-item 
              v-if="auth.isSuperuser" 
              index="dashboard"
            > 
              <el-icon><Monitor /></el-icon> <span>儀表板</span> 
            </el-menu-item>
            
            <!-- 金鑰管理模組 -->
            <el-sub-menu index="tool">
              <template #title> <el-icon><Key /></el-icon> <span>金鑰管理模組</span> </template>
              <el-menu-item index="tool1">金鑰清單</el-menu-item>
              <el-menu-item index="tool3">金鑰資訊圖表</el-menu-item>
              <el-menu-item index="tool4">金鑰輪替及更換</el-menu-item>
              
              <!-- 專案人員管理：非 Superuser 才顯示 -->
              <el-menu-item 
                v-if="!auth.isSuperuser" 
                index="tool5"
              >
                專案人員管理
              </el-menu-item>
            </el-sub-menu>

            <!-- 帳號管理 -->
            <el-sub-menu index="account">
              <template #title> <el-icon><User /></el-icon> <span>帳號管理</span> </template>
              <el-menu-item index="log1">帳號操作日誌</el-menu-item>
            </el-sub-menu>
            
            <!-- 專案管理：僅 Superuser 顯示 -->
            <el-menu-item 
              v-if="auth.isSuperuser" 
              index="project-manage"
            > 
              <el-icon><Setting /></el-icon> <span>專案管理</span> 
            </el-menu-item>

            <!-- 通知與提醒 -->
            <el-menu-item index="notifications"> 
              <el-icon><Bell /></el-icon> <span>通知與提醒</span> 
            </el-menu-item>

          </el-menu>
        </el-aside>

        <!-- 主要內容區 -->
        <el-main class="main-content">
          <slot />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
// --- Imports ---
import { 
  ArrowDown, 
  Monitor, 
  Setting, 
  House, 
  User, 
  Key,
  Bell
} from '@element-plus/icons-vue'
import { computed, watch, ref } from 'vue' 
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios' 

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// --- State ---
const projectList = ref<string[]>([]); // 儲存專案列表

// --- Computed Properties ---
const activeMenu = computed(() => {
  const path = route.path
  if (path === '/') return 'home'
  if (path === '/dashboard') return 'dashboard'
  
  // 處理工具路徑
  if (path.startsWith('/tools/')) { 
    if (path.includes('tool5')) return 'tool5'
    const toolIndex = path.split('/')[2]; 
    if (toolIndex) return toolIndex; 
  }
  
  if (path.startsWith('/account')) return 'account1'
  if (path.startsWith('/log')) return 'log1'
  
  if (path.startsWith('/project')) return 'project-manage'
  if (path.startsWith('/settings')) return 'settings'
  if (path.startsWith('/notifications')) return 'notifications'
  
  return ''
})

const selectedCodenameModel = computed({
    get: () => auth.currentSelectedCodename, 
    set: (value) => {
        if (value && value !== auth.currentSelectedCodename) { 
             auth.setSelectedCodename(value); 
        }
    }
});

// --- API Functions ---
// 透過 users/get_one 獲取使用者專案資訊
const fetchUserProjects = async () => {
  const username = auth.user?.username;
  if (!username) return;

  try {
    const token = localStorage.getItem('auth_token');
    const res = await axios.post(
      'http://localhost:8000/users/get_one',
      { username: username },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 同時接受 code 0 或 200 為成功狀態
    if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
      const userData = res.data.data;
      if (Array.isArray(userData.projects)) {
        // 從 projects array 中提取 codename
        projectList.value = userData.projects.map((p: any) => p.codename);
      } else {
        projectList.value = [];
      }
    } else {
      console.warn("API 回傳格式不符或失敗", res.data);
    }
  } catch (error) {
    console.error('Failed to fetch user projects:', error);
  }
};

// --- Watchers ---

// 1. 監聽 User Username，登入或切換帳號時重新抓取專案列表
watch(
  () => auth.user?.username,
  (newVal) => {
    if (newVal) {
      fetchUserProjects();
    } else {
      projectList.value = []; // 登出清空
    }
  },
  { immediate: true }
);

// 2. 監聽身分變更，若為 Superuser 預設選取 'all'
watch(
  () => auth.isSuperuser,
  (isSuper) => {
    // 當檢測到是 Superuser，且當前沒有選中 'all' 時，強制設為 'all'
    if (isSuper && auth.currentSelectedCodename !== 'all') {
      auth.setSelectedCodename('all');
    }
  },
  { immediate: true } 
);


// --- Methods ---
const handleLogout = async () => {
  await auth.logout();
}

const changePassword = async () => {
  router.push('/changepassword');
}

const handleMenuSelect = (index: string) => {
  switch (index) {
    case 'home': router.push('/'); break
    case 'dashboard': router.push('/dashboard'); break
    
    // 金鑰管理模組
    case 'tool1': router.push('/tools/tool1'); break
    case 'tool3': router.push('/tools/tool3'); break
    case 'tool4': router.push('/tools/tool4'); break
    case 'tool5': router.push('/tools/tool5'); break 
    
    // 帳號管理與日誌
    case 'log1': router.push('/log'); break 
    case 'account1': router.push('/account'); break 
    
    // 系統管理與通知
    case 'project-manage': router.push('/project'); break 
    case 'notifications': router.push('/notifications'); break 
    
    default: break
  }
}
</script>

<style>
/* --- 基礎和滾動控制 --- */
html, body { height: 100%; margin: 0; padding: 0; overflow: hidden !important; }
#__nuxt, .main-layout, .el-container { height: 100%; }

/* --- Header --- */
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
.right { display: flex; align-items: center; } 

/* --- Sidebar --- */
.main-sidebar {
  background-color: #fff; border-right: 1px solid #e6e6e6;
  position: fixed; left: 0; top: 60px; width: 220px;
  height: calc(100vh - 60px); z-index: 1000; overflow-y: auto;
  overflow-x: hidden; padding-bottom: 20px; box-sizing: border-box;
}
.main-menu { border-right: none; }

/* --- Main Content --- */
.main-content {
  margin-left: 220px; background-color: #f5f7fa;
  height: calc(100vh - 60px); overflow-y: auto !important;
  box-sizing: border-box !important; margin-top: 60px;
}

/* --- 圖標樣式 --- */
.el-menu-item [class^="el-icon"], .el-sub-menu [class^="el-icon"] {
  margin-right: 5px; width: 24px; text-align: center; font-size: 18px;
}
</style>