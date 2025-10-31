<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElDialog } from 'element-plus' // 引入 ElDialog (可選，模板直接用也可)
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

const logs = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedUsername = ref<string | null>('all')
const isCurrentUserAdmin = ref(false)

// --- 新增：Dialog 相關 Refs ---
const dialogVisible = ref(false)
const selectedLogDetail = ref('')

// --- Computed Properties ---

const isAdmin = computed(() => isCurrentUserAdmin.value)
const currentUsername = computed(() => auth.user?.username)
const allUsernames = computed(() => {
  if (!isAdmin.value) { return [] }
  const usernames = [...new Set(logs.value.map(log => log.username))]
  return usernames.sort()
})

const filteredLogs = computed(() => {
  let filtered = logs.value
  if (!isAdmin.value && currentUsername.value) {
    filtered = filtered.filter(log => log.username === currentUsername.value)
  }
  if (isAdmin.value && selectedUsername.value && selectedUsername.value !== 'all') {
    filtered = filtered.filter(log => log.username === selectedUsername.value)
  }
  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    filtered = filtered.filter(log => {
      const timeFormatted = formatDate(log.execution_time).toLowerCase()
      const resultText = log.execution_result ? '成功' : '失敗'
      return (
        log.username?.toLowerCase().includes(query) ||
        log.action?.toLowerCase().includes(query) ||
        timeFormatted.includes(query) ||
        resultText.toLowerCase().includes(query) ||
        log.detail?.toLowerCase().includes(query) // 雖然不顯示，但搜尋仍包含 detail
      )
    })
  }
  return filtered
})

// --- Data Fetching ---

const fetchCurrentUserRole = async (): Promise<boolean> => {
    const username = currentUsername.value;
    if (!username) {
        ElMessage.error('無法獲取當前用戶名稱，請重新登入');
        router.push('/login');
        return false;
    }
    try {
        const savedToken = localStorage.getItem('auth_token');
        if (!savedToken) {
            ElMessage.error('尚未登入，請先登入');
            router.push('/login');
            return false;
        }
        console.log(`Fetching role for user: ${username}`);
        const res = await axios.post('http://localhost:8000/users/get_one',
            { username: username },
            { headers: { Authorization: `Bearer ${savedToken}` } }
        );
        if (res.data && res.data.code === 200 && res.data.data) {
            const userRole = res.data.data.role;
            console.log(`User role fetched: ${userRole}`);
            isCurrentUserAdmin.value = userRole === 'admin';
            return true;
        } else {
            console.error('獲取用戶角色回傳格式不正確:', res.data);
            ElMessage.warning('無法獲取用戶角色資訊');
            isCurrentUserAdmin.value = false;
            return false;
        }
    } catch (err: any) {
        console.error("獲取用戶角色時出錯:", err);
        ElMessage.error(err.response?.data?.message || '無法獲取用戶角色資訊');
        isCurrentUserAdmin.value = false;
        return false;
    }
}

const fetchLogs = async () => {
  logs.value = []
  try {
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      router.push('/login')
      return
    }
    console.log('Fetching logs...');
    const res = await axios.get('http://localhost:8000/logs/get_all', {
      headers: { Authorization: `Bearer ${savedToken}` }
    })
    if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
      logs.value = res.data.data
      console.log(`Fetched ${logs.value.length} logs.`);
      if (isAdmin.value) {
          selectedUsername.value = 'all';
      }
    } else {
      console.error('Log API response format error:', res.data)
      ElMessage.warning(res.data.message || '無法獲取日誌資料或格式錯誤')
    }
  } catch (err: any) {
    console.error('Error fetching logs:', err)
    ElMessage.error(err.response?.data?.message || '獲取日誌資料時發生錯誤')
  }
}

// --- Helper Functions ---

const formatDate = (dateString: string | null | undefined): string => {
 try {
        return dateString ? new Date(dateString).toLocaleString() : 'N/A';
     } catch (e) {
        console.warn(`Invalid date format for: ${dateString}`);
        return 'Invalid Date';
     }
};

// *** 新增：處理查看詳細按鈕點擊 ***
const handleViewDetail = (logEntry: any) => {
    selectedLogDetail.value = logEntry.detail || '沒有詳細資訊'; // 設置要顯示的內容
    dialogVisible.value = true; // 打開對話框
}

// --- Lifecycle ---

onMounted(async () => {
  loading.value = true;
  console.log('Log page mounted. Fetching current user role...');
  const roleFetchedSuccess = await fetchCurrentUserRole();
  if (roleFetchedSuccess) {
      console.log('Role fetch successful. Fetching logs...');
      await fetchLogs();
      console.log('Log fetching complete.');
  } else {
      console.log('Role fetch failed. Skipping log fetch.');
  }
  loading.value = false;
})

</script>

<template>
  <div class="log-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>帳號操作日誌</span>
          <div class="filter-controls">
            <el-select
              v-if="isAdmin"
              v-model="selectedUsername"
              placeholder="選擇使用者"
              size="small"
              style="width: 200px; margin-right: 10px;"
              clearable
              filterable
            >
              <el-option label="全部使用者" value="all"></el-option>
              <el-option
                v-for="username in allUsernames"
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
        <el-table :data="filteredLogs" v-loading="loading" style="width: 100%" border stripe height="600">
          <el-table-column prop="username" label="使用者帳號" width="150" sortable />
          <el-table-column prop="action" label="操作行為" width="180" sortable />
          <el-table-column prop="execution_time" label="執行時間" width="200" sortable>
            <template #default="scope">
              {{ formatDate(scope.row.execution_time) }}
            </template>
          </el-table-column>
          <el-table-column prop="execution_result" label="執行結果" width="100" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.execution_result ? 'success' : 'danger'">
                {{ scope.row.execution_result ? '成功' : '失敗' }}
              </el-tag>
            </template>
          </el-table-column>
          {/* *** 修改：移除 Detail 欄位 *** */}
          {/* <el-table-column prop="detail" label="詳細資訊" min-width="300" show-overflow-tooltip /> */}

          {/* *** 新增：操作欄位 *** */}
          <el-table-column label="操作" width="120" align="center">
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

    <el-dialog
        v-model="dialogVisible"
        title="詳細資訊"
        width="50%"
        draggable
      >
      <pre style="white-space: pre-wrap; word-wrap: break-word;">{{ selectedLogDetail }}</pre>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">關閉</el-button>
        </span>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
/* 頁面 padding 已加到 template */
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filter-controls { display: flex; align-items: center; }
.table-container { width: 100%; }
.el-table :deep(.el-table__header-wrapper) { position: sticky; top: 0; z-index: 10; background-color: white; /* 確保表頭背景不透明 */}

/* Dialog 內容樣式 (可選) */
pre {
    background-color: #f8f8f8;
    padding: 15px;
    border-radius: 4px;
    max-height: 400px; /* 限制最大高度 */
    overflow-y: auto; /* 超出時內部滾動 */
}
</style>