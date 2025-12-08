<template>
  <div class="detail-page" style="padding: 20px;">
    
    <!-- Header: 顯示專案名稱與返回按鈕 -->
    <div class="page-header">
      <div class="header-left">
        <el-button link @click="goBack" class="back-btn">
          <el-icon :size="20"><Back /></el-icon>
          <span class="back-text">返回儀表板</span>
        </el-button>
        <div class="divider"></div>
        <h2 class="page-title">
          {{ projectname }} 
          <span class="subtitle">({{ codename }})</span>
        </h2>
      </div>
    </div>

    <!-- 主要內容區 -->
    <el-card shadow="never" v-loading="loading">
      
      <!-- 情境 A: 金鑰列表 (View Type = key) -->
      <div v-if="viewType === 'key'">
        <el-empty v-if="projectKeys.length === 0" description="此專案尚無金鑰" />
        <el-table v-else :data="projectKeys" stripe border style="width: 100%">
          <el-table-column prop="key_id" label="金鑰 ID" min-width="250" />
          <el-table-column prop="key_state" label="狀態" width="120" align="center">
            <template #default="scope">
               <el-tag :type="scope.row.key_state === 'Active' ? 'success' : 'info'">{{ scope.row.key_state }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="rotation_state" label="輪替狀態" width="150" align="center" />
          <el-table-column prop="key_create_time" label="建立時間" width="200">
             <template #default="scope">{{ formatDate(scope.row.key_create_time) }}</template>
          </el-table-column>
          <el-table-column prop="key_description" label="描述" />
        </el-table>
      </div>

      <!-- 情境 B: 人員列表 (View Type = user) -->
      <div v-else-if="viewType === 'user'">
        <el-empty v-if="projectUsers.length === 0" description="此專案尚無人員配置" />
        <el-table v-else :data="projectUsers" stripe border style="width: 100%">
          <el-table-column prop="username" label="使用者名稱" />
          <el-table-column label="專案角色" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.projectrole === 'admin' ? 'danger' : 'info'">
                {{ scope.row.projectrole ? scope.row.projectrole.toUpperCase() : 'UNKNOWN' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Back } from '@element-plus/icons-vue'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()

// --- Query Params ---
const codename = computed(() => route.query.codename as string || '')
const projectname = computed(() => route.query.projectname as string || '未命名專案')
const viewType = computed(() => route.query.type as 'key' | 'user') // 'key' or 'user'

// --- State ---
const loading = ref(false)
const projectKeys = ref<any[]>([])
const projectUsers = ref<any[]>([])

// --- Methods ---

const goBack = () => {
  router.push('/dashboard')
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString()
}

// 獲取資料的主邏輯
const fetchData = async () => {
  if (!codename.value) {
    ElMessage.warning('缺少專案代號')
    return
  }

  loading.value = true
  const token = localStorage.getItem('auth_token')

  try {
    if (viewType.value === 'key') {
      // 1. 獲取金鑰資料
      // 邏輯：打 /keys/get_all 取回全部，然後前端 filter 此專案的 codename
      const res = await axios.get('http://localhost:8000/keys/get_all', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && (res.data.code === 0 || res.data.code === 200)) {
        const allKeys = res.data.data || []
        // 前端篩選
        projectKeys.value = allKeys.filter((k: any) => k.codename === codename.value)
      }

    } else if (viewType.value === 'user') {
      // 2. 獲取人員資料
      // 邏輯：打 /projects/get_one (或 get_all) 取得該專案詳細資訊中的 projectinfo
      // 這裡假設使用 POST /projects/get_one，因為在之前的對話中有提到這個 API
      const res = await axios.post('http://localhost:8000/projects/get_one', 
        { codename: codename.value },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
        projectUsers.value = res.data.data.projectinfo || []
      }
    }
  } catch (error) {
    console.error('Fetch detail error:', error)
    ElMessage.error('獲取詳細資料失敗')
  } finally {
    loading.value = false
  }
}

// --- Lifecycle ---
onMounted(() => {
  fetchData()
})

</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  background-color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-btn {
  display: flex;
  align-items: center;
  color: #606266;
  font-size: 16px;
  padding-left: 0;
}

.back-btn:hover {
  color: #409eff;
}

.back-text {
  margin-left: 5px;
  font-weight: 500;
}

.divider {
  width: 1px;
  height: 20px;
  background-color: #dcdfe6;
  margin: 0 15px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 10px;
}

.subtitle {
  font-size: 14px;
  color: #909399;
  font-weight: normal;
}

.type-tag {
  margin-left: 10px;
  font-weight: normal;
}
</style>