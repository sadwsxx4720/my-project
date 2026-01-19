<template>
  <div class="home-page">
    <el-row :gutter="20">
      
      <!-- 1. 快速開始 (全寬) -->
      <el-col :span="24" class="mb-4">
        <el-card shadow="hover" class="feature-card">
          <template #header>
            <div class="card-header">
              <h3><el-icon class="header-icon"><Lightning /></el-icon> 快速開始</h3>
            </div>
          </template>
          
          <div class="quick-start-grid">
            <div 
              v-for="item in quickStartItems" 
              :key="item.path" 
              class="quick-btn"
              @click="router.push(item.path)"
            >
              <el-icon class="quick-icon" :size="32">
                <component :is="item.icon" />
              </el-icon>
              <span class="quick-label">{{ item.label }}</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 2. 我的專案 / 專案概覽 (新增區塊) -->
      <el-col :span="24">
        <el-card shadow="hover" class="projects-card" v-loading="loading">
          <template #header>
            <div class="card-header">
              <h3><el-icon class="header-icon"><Folder /></el-icon> 我的專案</h3>
              <el-button link type="primary" @click="fetchProjects">
                <el-icon><Refresh /></el-icon> 重新整理
              </el-button>
            </div>
          </template>

          <!-- 專案列表 -->
          <div v-if="projects.length > 0" class="project-grid">
            <el-card 
              v-for="project in projects" 
              :key="project.projectid" 
              shadow="hover" 
              class="project-item-card"
            >
              <div class="project-content">
                <div class="project-info">
                  <h4 class="project-name">{{ project.projectname }}</h4>
                  <div class="project-meta">
                    <el-tag size="small" type="info">{{ project.codename }}</el-tag>
                    <el-tag 
                      v-if="getUserRole(project)" 
                      size="small" 
                      :type="getUserRole(project) === 'admin' ? 'danger' : undefined"
                      effect="plain"
                    >
                      {{ getUserRole(project)?.toUpperCase() }}
                    </el-tag>
                  </div>
                </div>
                
                <div class="project-actions">
                  <!-- 根據權限動態顯示按鈕文字 -->
                  <el-button 
                    type="primary" 
                    plain 
                    size="small" 
                    @click="navigateToDetail(project)"
                  >
                    {{ auth.isSuperuser ? '專案管理' : '專案人員管理' }}
                  </el-button>
                  <el-button 
                    type="success" 
                    plain 
                    size="small" 
                    @click="navigateToKeyList(project)"
                  >
                    金鑰清單
                  </el-button>
                </div>
              </div>
            </el-card>
          </div>

          <el-empty v-else description="目前沒有專案資料" />
        </el-card>
      </el-col>

    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { 
  Monitor, 
  Setting, 
  Key, 
  User, 
  Lightning, 
  Folder, 
  Refresh, 
  DataLine, 
  Bell,
  Management
} from '@element-plus/icons-vue'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

// --- State ---
const loading = ref(false)
const projects = ref<any[]>([])

// --- Computed: Quick Start Items based on Role ---
const quickStartItems = computed(() => {
  const items = []

  // Superuser 權限
  if (auth.isSuperuser) {
    items.push({ label: '查看儀表板', icon: Monitor, path: '/dashboard' })
    items.push({ label: '金鑰管理', icon: Key, path: '/tools/tool1' })
    items.push({ label: '帳號操作日誌', icon: User, path: '/log' })
    items.push({ label: '專案管理', icon: Management, path: '/project' }) 
    items.push({ label: '通知與提醒', icon: Bell, path: '/settings' })
  } 
  // 非 Superuser 權限
  else {
    items.push({ label: '金鑰管理', icon: Key, path: '/tools/tool1' })
    items.push({ label: '帳號操作日誌', icon: User, path: '/log' })
    items.push({ label: '通知與提醒', icon: Bell, path: '/settings' })
  }

  return items
})

// --- Methods ---

// 1. 獲取專案資料
const fetchProjects = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return // 未登入由 layout 處理導向

    let res
    const timestamp = new Date().getTime()

    // 根據權限決定呼叫哪個 API
    if (auth.isSuperuser) {
      // Superuser: 獲取所有專案
      res = await axios.get(`http://localhost:8000/projects/get_all?t=${timestamp}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } else {
      // 一般使用者: 獲取自己參與的專案
      const username = auth.user?.username
      if (!username) return
      
      res = await axios.post(
        'http://localhost:8000/projects/get_by_username',
        { username },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    }

    if (res.data && (res.data.code === 0 || res.data.code === 200) && Array.isArray(res.data.data)) {
      // 【修正】使用自然排序 (numeric: true) 確保 Project 1, 4, 15 順序正確
      projects.value = res.data.data.sort((a: any, b: any) => {
        return (a.projectname || '').localeCompare(b.projectname || '', undefined, { numeric: true })
      })
    } else {
      projects.value = []
    }
  } catch (error) {
    console.error('Fetch projects error:', error)
    ElMessage.error('無法載入專案資料')
  } finally {
    loading.value = false
  }
}

// 2. 從專案資料中取得當前使用者的角色
const getUserRole = (project: any) => {
  if (!auth.user?.username || !project.projectinfo) return null
  const member = project.projectinfo.find((m: any) => m.username === auth.user?.username)
  return member ? member.projectrole : null
}

// 3. 跳轉至專案相關頁面 (依據需求修改連結目標)
const navigateToDetail = (project: any) => {
  // 設定全域選中專案
  auth.setSelectedCodename(project.codename)

  if (auth.isSuperuser) {
    // Superuser -> 連結到專案管理頁面 (/project) 的對應詳細資訊
    // 透過 query 傳遞參數，目標頁面需實作接收邏輯
    router.push({
      path: '/project',
      query: {
        codename: project.codename,
        view: 'details' // 指示目標頁面開啟詳細資訊模式
      }
    })
  } else {
    // 非 Superuser -> 連結到專案人員管理頁面
    router.push({
      path: '/tools/tool5',
      query: {
        codename: project.codename
      }
    })
  }
}

// 4. 跳轉至金鑰清單 (/tools/tool1) 並預選該專案
const navigateToKeyList = (project: any) => {
  // 設定 Store 中的全域專案選擇
  auth.setSelectedCodename(project.codename)
  router.push('/tools/tool1')
}

// --- Lifecycle ---
onMounted(() => {
  fetchProjects()
})

</script>

<style scoped>
.home-page {
  padding: 20px;
}

.mb-4 {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  color: #303133;
}

.header-icon {
  color: #409eff;
}

/* 快速開始 Grid 樣式 */
.quick-start-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); /* 自動適應寬度 */
  gap: 20px;
  padding: 10px 0;
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 25px 10px;
  background-color: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.quick-btn:hover {
  background-color: #ecf5ff;
  border-color: #409eff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.quick-icon {
  color: #606266;
  margin-bottom: 10px;
  transition: color 0.3s;
}

.quick-btn:hover .quick-icon {
  color: #409eff;
}

.quick-label {
  font-weight: 500;
  color: #303133;
}

/* 專案列表 Grid 樣式 */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.project-item-card {
  transition: all 0.3s;
  border-radius: 8px;
}

.project-item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.project-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.project-info {
  flex: 1;
  margin-bottom: 15px;
}

.project-name {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #303133;
  /* 文字過長處理 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.project-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #ebeef5;
  padding-top: 15px;
}
</style>