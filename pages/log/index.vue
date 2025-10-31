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
const selectedUsername = ref<string | null>(null) // 修改：預設為 null
const isCurrentUserAdmin = ref(false)

// --- Dialog 相關 Refs ---
const dialogVisible = ref(false)
const selectedLogDetail = ref('')

// --- Computed Properties ---

const isAdmin = computed(() => isCurrentUserAdmin.value)
const currentUsername = computed(() => auth.user?.username)

// *** 修改：移除 'all' 選項 ***
const allUsernames = computed(() => {
  if (!isAdmin.value) { return [] }
  const usernames = [...new Set(logs.value.map(log => log.username))]
  return usernames.sort()
})

// *** 修改：過濾邏輯 ***
const filteredLogs = computed(() => {
  let filtered = logs.value
  
  // 1. Role-based pre-filtering
  if (!isAdmin.value && currentUsername.value) {
    filtered = filtered.filter(log => log.username === currentUsername.value)
  }

  // 2. Admin Username Dropdown Filter
  // *** 修改：移除 'all' 檢查 ***
  if (isAdmin.value && selectedUsername.value) { // 檢查 selectedUsername 是否有值
    filtered = filtered.filter(log => log.username === selectedUsername.value)
  }

  // 3. Search Query Filter
  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    filtered = filtered.filter(log => {
      
      // --- *** 這裡是修改後的搜尋邏輯 (START) *** ---
      
      // 1. 檢查使用者可見的「格式化後」的欄位
      const timeFormatted = formatDate(log.execution_time).toLowerCase()
      const resultText = (log.execution_result ? '成功' : '失敗').toLowerCase()

      if (timeFormatted.includes(query) || resultText.includes(query)) {
        return true;
      }

      // 2. 檢查 log 物件中的「所有」原始值 (轉換為字串)
      //    這會涵蓋 username, action, detail, 以及任何其他欄位
      return Object.values(log).some(value => {
        if (value === null || value === undefined) {
          return false;
        }
        // 將所有值（數字、布林值、字串）轉為字串並搜尋
        return String(value).toLowerCase().includes(query);
      });
      
      // --- *** 這裡是修改後的搜尋邏輯 (END) *** ---

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
      
      // *** 修改：設置預設下拉選單值 ***
      if (isAdmin.value) {
          // 如果是 Admin，預設為當前登入的 Admin 帳號
          selectedUsername.value = currentUsername.value || null; 
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

// 處理查看詳細按鈕點擊
const handleViewDetail = (logEntry: any) => {
    // *** 修改：跳轉到新頁面 ***
    try {
        const logDataString = JSON.stringify(logEntry);
        router.push({ 
            path: '/log/detail', // *** 跳轉到新的詳細頁面 ***
            query: { data: logDataString } // *** 傳遞序列化的數據 ***
        });
    } catch (e) {
        console.error("無法序列化日誌數據:", e);
        ElMessage.error("無法顯示詳細資訊");
    }
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
        <el-table :data="filteredLogs" v-loading="loading" style="width: 100%" border stripe>
          {/* *** 修改：移除所有 width 屬性 *** */}
          <el-table-column prop="username" label="使用者帳號" sortable />
          <el-table-column prop="action" label="操作行為" sortable />
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
/* 頁面 padding 已加到 template */
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filter-controls { display: flex; align-items: center; }
.table-container { width: 100%; }

/* *** 修改：移除 sticky header 樣式 *** */
/* .el-table :deep(.el-table__header-wrapper) { ... } */

/* 移除 Dialog 相關樣式 */
/* pre { ... } */
</style>