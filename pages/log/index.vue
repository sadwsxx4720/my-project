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
const searchQuery = ref('')
const selectedUsername = ref<string | null>(null) // 下拉選單選擇的成員

// 專案相關狀態
const currentProjectMembers = ref<any[]>([]) // 當前專案的成員列表
const currentUserProjectRole = ref<string | null>(null) // 當前使用者在該專案的角色 (admin/viewer)

// --- Computed Properties ---

const isSuperuser = computed(() => auth.isSuperuser)
const currentUsername = computed(() => auth.user?.username || '')
const currentCodename = computed(() => auth.currentSelectedCodename)

// 計算當前在該專案是否為 Admin (Superuser 視為擁有所有 Admin 權限)
const isProjectAdmin = computed(() => {
  return isSuperuser.value || currentUserProjectRole.value === 'admin'
})

// 計算下拉選單要顯示的成員列表
const memberOptions = computed(() => {
  // 如果是 Superuser 且選了 "全部專案"，顯示 Log 中出現過的所有人
  if (isSuperuser.value && currentCodename.value === 'all') {
    const uniqueUsers = [...new Set(logs.value.map(log => log.username))]
    return uniqueUsers.sort()
  }
  
  // 如果是 Project Admin (或 Superuser 在特定專案)，顯示該專案的成員
  if (isProjectAdmin.value) {
    return currentProjectMembers.value.map(m => m.username).sort()
  }

  // Viewer 只能看自己，不需要下拉選單 (或者只有自己)
  return [currentUsername.value]
})

// *** 核心過濾邏輯 ***
const filteredLogs = computed(() => {
  let result = logs.value

  // 1. 專案篩選 (Project Filter)
  if (currentCodename.value && currentCodename.value !== 'all') {
    // 篩選 Log 的 codename 欄位 (假設 Log 有紀錄 codename)
    // 如果 Log 沒有 codename 欄位，則改用「是否為專案成員」來判斷
    result = result.filter(log => {
      // 優先比對 log.codename
      if (log.codename) return log.codename === currentCodename.value
      // 若無，則檢查該 log 的 username 是否在專案成員名單中 (Fallback)
      return currentProjectMembers.value.some(m => m.username === log.username)
    })
  }

  // 2. 角色權限篩選 (Role Permission)
  if (isSuperuser.value) {
    // Superuser: 可以看所有 (已通過專案篩選的) 資料
  } else if (currentUserProjectRole.value === 'admin') {
    // Project Admin: 可以看所有 (已通過專案篩選的) 資料
  } else {
    // Project Viewer (或其他): 強制只能看自己的
    result = result.filter(log => log.username === currentUsername.value)
  }

  // 3. 成員下拉篩選 (Dropdown Filter - 僅 Admin/Superuser 有效)
  if (isProjectAdmin.value && selectedUsername.value) {
    result = result.filter(log => log.username === selectedUsername.value)
  }

  // 【新增修正】若已選擇特定專案，補全 Log 的 codename 欄位以供顯示
  if (currentCodename.value && currentCodename.value !== 'all') {
    result = result.map(log => ({
      ...log,
      codename: log.codename || currentCodename.value
    }))
  }

  // 4. 關鍵字搜尋 (Search Query)
  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    result = result.filter(log => {
      const timeFormatted = formatDate(log.execution_time).toLowerCase()
      const resultText = (log.execution_result ? '成功' : '失敗').toLowerCase()
      
      if (timeFormatted.includes(query) || resultText.includes(query)) return true

      return Object.values(log).some(value => {
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(query)
      })
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
    
    const res = await axios.get('http://localhost:8000/logs/get_all', {
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

// 2. 獲取當前選擇專案的詳細資訊 (為了判斷 Role 和取得成員名單)
const fetchProjectDetails = async (codename: string) => {
  if (!codename || codename === 'all') {
    currentProjectMembers.value = []
    currentUserProjectRole.value = null
    return
  }

  try {
    const token = localStorage.getItem('auth_token')
    // 使用 get_one 或 get_by_username 視後端支援，這裡假設用 projects/get_one 獲取專案詳情
    // 注意：後端 API 必須支援透過 codename 查詢
    // 假設 Payload 為 { codename: "..." }
    const res = await axios.post(
      'http://localhost:8000/projects/get_one', 
      { codename: codename },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
      const projectData = res.data.data
      
      // 1. 設定成員名單
      currentProjectMembers.value = projectData.projectinfo || []

      // 2. 判斷當前 User 在此專案的角色
      const myInfo = currentProjectMembers.value.find((m: any) => m.username === currentUsername.value)
      currentUserProjectRole.value = myInfo ? myInfo.projectrole : 'viewer' // 若找不到預設 viewer 或 null

    } else {
      console.warn('Project details fetch failed for role check')
    }
  } catch (error) {
    console.error('Fetch project details error:', error)
  }
}

// --- Watchers ---

// 監聽專案切換，重新判斷權限
watch(currentCodename, async (newCode) => {
  selectedUsername.value = null // 切換專案時重置成員篩選
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

// 處理查看詳細按鈕點擊
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
  // 確保初始化時也跑一次專案權限判斷
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
            <!-- 顯示當前權限狀態 (除錯或提示用) -->
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
            <!-- 成員篩選 (僅 Admin/Superuser 可見) -->
            <el-select
              v-if="isProjectAdmin"
              v-model="selectedUsername"
              placeholder="篩選成員"
              size="small"
              style="width: 200px; margin-right: 10px;"
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
              placeholder="搜尋日誌內容..."
              size="small"
              style="width: 300px;"
              clearable
            />
          </div>
        </div>
      </template>

      <div class="table-container">
        <el-table :data="filteredLogs" v-loading="loading" style="width: 100%" border stripe>
          <!-- 【確保有專案代號欄位】 -->
          <el-table-column prop="codename" label="專案代號" width="120" sortable />
          <el-table-column prop="username" label="使用者帳號" width="150" sortable />
          <el-table-column prop="action" label="操作行為" width="200" sortable />
          <el-table-column prop="execution_time" label="執行時間" sortable>
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
          
          <el-table-column label="操作" align="center" width="120"> 
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                link
                @click="handleViewDetail(scope.row)"
              >
                查看詳細內容
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
.filter-controls { display: flex; align-items: center; }
.table-container { width: 100%; }
.ml-2 { margin-left: 8px; }
</style>