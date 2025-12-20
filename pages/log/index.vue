<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

// --- State ---
const logs = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('') // 關鍵字搜尋
const dateRange = ref([]) // 時間範圍搜尋 [start, end]
const selectedUsername = ref<string | null>(null) // 下拉選單選擇的成員

// 專案相關狀態
const currentProjectMembers = ref<any[]>([]) 
const currentUserProjectRole = ref<string | null>(null) 

// --- Computed Properties ---

const isSuperuser = computed(() => auth.isSuperuser)
const currentUsername = computed(() => auth.user?.username || '')
const currentCodename = computed(() => auth.currentSelectedCodename)

// 計算當前在該專案是否為 Admin
const isProjectAdmin = computed(() => {
  return isSuperuser.value || currentUserProjectRole.value === 'admin'
})

// 計算下拉選單要顯示的成員列表
const memberOptions = computed(() => {
  if (isSuperuser.value && currentCodename.value === 'all') {
    const uniqueUsers = [...new Set(logs.value.map(log => log.username))]
    return uniqueUsers.sort()
  }
  if (isProjectAdmin.value) {
    return currentProjectMembers.value.map(m => m.username).sort()
  }
  return [currentUsername.value]
})

// *** 核心過濾邏輯 (修正版) ***
const filteredLogs = computed(() => {
  // 1. 基礎資料與專案代號補全
  // 如果是特定專案視角，且 Log 缺代號，自動補上；如果是 All 視角，維持原樣
  let result = logs.value.map(log => {
    if (currentCodename.value && currentCodename.value !== 'all' && !log.codename) {
      return { ...log, codename: currentCodename.value }
    }
    return log
  })

  // 2. 專案篩選 (Project Filter)
  if (currentCodename.value && currentCodename.value !== 'all') {
    result = result.filter(log => {
      // 比對 codename，或檢查 username 是否為該專案成員
      if (log.codename) return log.codename === currentCodename.value
      return currentProjectMembers.value.some(m => m.username === log.username)
    })
  }

  // 3. 角色權限篩選 (Role Permission)
  if (isSuperuser.value) {
    // Superuser 可見所有
  } else if (currentUserProjectRole.value === 'admin') {
    // Admin 可見該專案所有
  } else {
    // Viewer 只能看自己
    result = result.filter(log => log.username === currentUsername.value)
  }

  // 4. 成員下拉篩選 (Dropdown Filter)
  if (isProjectAdmin.value && selectedUsername.value) {
    result = result.filter(log => log.username === selectedUsername.value)
  }

  // 5. 時間範圍篩選 (Time Range Filter)
  if (dateRange.value && dateRange.value.length === 2) {
    const startTime = new Date(dateRange.value[0]).getTime()
    const endTime = new Date(dateRange.value[1]).getTime()
    
    result = result.filter(log => {
      if (!log.execution_time) return false
      const logTime = new Date(log.execution_time).getTime()
      return logTime >= startTime && logTime <= endTime
    })
  }

  // 6. 【修正】關鍵字搜尋 (Keyword Search) - 僅針對「使用者帳號」
  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    result = result.filter(log => {
      const username = log.username;
      if (username === null || username === undefined) return false;
      // 只比對 username 欄位
      return String(username).toLowerCase().includes(query);
    })
  }

  return result
})

// --- API Functions ---

// 1. 獲取所有 Logs
const fetchLogs = async () => {
  loading.value = true
  logs.value = []
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      ElMessage.error('尚未登入')
      router.push('/login')
      return
    }
    
    // 加上時間戳防止快取
    const res = await axios.get(`http://localhost:8000/logs/get_all?t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
      logs.value = res.data.data
    } else {
      console.warn('Logs API format issue:', res.data)
    }
  } catch (err: any) {
    console.error('Fetch logs error:', err)
    ElMessage.error('無法獲取日誌資料')
  } finally {
    loading.value = false
  }
}

// 2. 獲取當前選擇專案的詳細資訊
const fetchProjectDetails = async (codename: string) => {
  if (!codename || codename === 'all') {
    currentProjectMembers.value = []
    currentUserProjectRole.value = null
    return
  }

  try {
    const token = localStorage.getItem('auth_token')
    const res = await axios.post(
      'http://localhost:8000/projects/get_one', 
      { codename: codename },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
      const projectData = res.data.data
      currentProjectMembers.value = projectData.projectinfo || []
      const myInfo = currentProjectMembers.value.find((m: any) => m.username === currentUsername.value)
      currentUserProjectRole.value = myInfo ? myInfo.projectrole : 'viewer'
    } else {
      console.warn('Project details fetch failed for role check')
    }
  } catch (error) {
    console.error('Fetch project details error:', error)
  }
}

// --- Watchers ---

watch(currentCodename, async (newCode) => {
  selectedUsername.value = null 
  if (newCode) {
    await fetchProjectDetails(newCode)
  }
}, { immediate: true })

// --- Helper Functions ---

const formatDate = (dateString: string | null | undefined): string => {
 try {
    return dateString ? new Date(dateString).toLocaleString() : 'N/A';
 } catch (e) {
    return 'Invalid Date';
 }
};

const handleViewDetail = (logEntry: any) => {
    try {
        const logDataString = JSON.stringify(logEntry);
        router.push({ 
            path: '/log/detail', 
            query: { data: logDataString } 
        });
    } catch (e) {
        ElMessage.error("無法顯示詳細資訊");
    }
}

// --- Lifecycle ---

onMounted(async () => {
  await fetchLogs()
  if (currentCodename.value && currentCodename.value !== 'all') {
    await fetchProjectDetails(currentCodename.value)
  }
})

</script>

<template>
  <div class="log-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span>帳號操作日誌</span>
            <el-tag 
              v-if="currentCodename !== 'all'" 
              size="small" 
              :type="isProjectAdmin ? 'danger' : 'info'" 
              class="ml-2"
            >
              {{ isSuperuser ? 'Superuser' : (currentUserProjectRole ? currentUserProjectRole.toUpperCase() : 'VIEWER') }}
            </el-tag>
          </div>
          
          <div class="filter-controls">
            <!-- 時間範圍篩選器 -->
            <el-date-picker
              v-model="dateRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="開始時間"
              end-placeholder="結束時間"
              size="small"
              style="width: 340px; margin-right: 10px;"
              format="YYYY-MM-DD HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
            />

            <!-- 成員篩選 (僅 Admin/Superuser 可見) -->
            <el-select
              v-if="isProjectAdmin"
              v-model="selectedUsername"
              placeholder="篩選成員"
              size="small"
              style="width: 150px; margin-right: 10px;"
              clearable
              filterable
            >
              <el-option
                v-for="username in memberOptions"
                :key="username"
                :label="username"
                :value="username"
              />
            </el-select>

            <el-input
              v-model="searchQuery"
              placeholder="搜尋使用者帳號..."
              size="small"
              style="width: 250px;"
              clearable
              prefix-icon="Search"
            />
          </div>
        </div>
      </template>

      <div class="table-container">
        <el-table :data="filteredLogs" v-loading="loading" style="width: 100%" border stripe>
          <!-- 專案代號欄位 -->
          <el-table-column prop="codename" label="專案代號" width="120" sortable show-overflow-tooltip>
            <template #default="scope">
              {{ scope.row.codename || '-' }}
            </template>
          </el-table-column>
          
          <el-table-column prop="username" label="使用者帳號" width="150" sortable />
          <el-table-column prop="action" label="操作行為" width="200" sortable show-overflow-tooltip />
          
          <el-table-column prop="execution_time" label="執行時間" sortable width="180">
            <template #default="scope">
              {{ formatDate(scope.row.execution_time) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="execution_result" label="執行結果" align="center" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.execution_result ? 'success' : 'danger'">
                {{ scope.row.execution_result ? '成功' : '失敗' }}
              </el-tag>
            </template>
          </el-table-column>
          
          <!-- 加入詳細內容欄位，顯示部分資訊，避免畫面太寬 -->
          <el-table-column prop="detail" label="詳細內容" min-width="200" show-overflow-tooltip />

          <el-table-column label="操作" align="center" width="120" fixed="right"> 
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                link
                @click="handleViewDetail(scope.row)"
              >
                查看詳細
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: center; }
.filter-controls { display: flex; align-items: center; gap: 10px; }
.table-container { width: 100%; }
.ml-2 { margin-left: 8px; }
</style>