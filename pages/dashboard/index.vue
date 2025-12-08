<template>
  <div class="dashboard-page" style="padding: 20px;">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>專案概覽</span>
            </div>
          </template>

          <el-skeleton :rows="5" animated v-if="loading" />

          <div v-else>
            <!-- 統計卡片 -->
            <el-row :gutter="20" class="stats-row">
              <el-col :span="8">
                <el-card shadow="hover" class="stat-card">
                  <h3>專案總數</h3>
                  <div class="stat-value">{{ projects.length }}</div>
                </el-card>
              </el-col>
              <el-col :span="16">
                <el-card shadow="never" class="stat-card info-card">
                  <div class="info-text">
                    <el-icon><InfoFilled /></el-icon>
                    <span>請從下方列表選擇專案，以檢視詳細的金鑰或人員配置。</span>
                  </div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 專案列表表格 -->
            <el-row :gutter="20" class="action-row">
              <el-col :span="24">
                <el-card shadow="hover">
                  <h3>專案列表</h3>
                  <el-table :data="projects" stripe style="width: 100%" border>
                      <el-table-column prop="projectname" label="專案名稱" sortable />
                      <el-table-column prop="codename" label="專案代號" sortable />
                      
                      <!-- 操作欄位 -->
                      <el-table-column label="詳細資訊" width="300" align="center">
                          <template #default="scope">
                              <div class="action-buttons">
                                <!-- 查看金鑰按鈕 -->
                                <el-button 
                                  size="small" 
                                  type="warning" 
                                  plain 
                                  @click="navigateToDetail(scope.row, 'key')"
                                >
                                  查看金鑰詳細資訊
                                </el-button>

                                <!-- 查看人員按鈕 -->
                                <el-button 
                                  size="small" 
                                  type="primary" 
                                  plain 
                                  @click="navigateToDetail(scope.row, 'user')"
                                >
                                  查看人員詳細資訊
                                </el-button>
                              </div>
                          </template>
                      </el-table-column>
                  </el-table>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Refresh, InfoFilled, Key, User } from '@element-plus/icons-vue'

definePageMeta({
  layout: 'default'
})

const router = useRouter()

// --- Refs ---
const loading = ref(true)
const projects = ref<any[]>([])

// --- API Functions ---
const fetchProjects = async () => {
    loading.value = true
    try {
        const savedToken = localStorage.getItem('auth_token')
        if (!savedToken) {
            ElMessage.error('尚未登入，請先登入')
            router.push('/login')
            return
        }

        // 獲取所有專案列表
        // 注意：這裡使用 timestamp 防止 API 快取
        const res = await axios.get(`http://localhost:8000/projects/get_all?t=${new Date().getTime()}`, {
            headers: { Authorization: `Bearer ${savedToken}` }
        })

        if (res.data && (res.data.code === 0 || res.data.code === 200) && Array.isArray(res.data.data)) {
            projects.value = res.data.data
        } else {
            console.error('專案資料格式不正確:', res.data)
            // 若 API 失敗但不影響頁面呈現，可視情況不跳出錯誤提示，或設為空陣列
            projects.value = [] 
        }
    } catch (err) {
        console.error("API 錯誤:", err)
        ElMessage.error('獲取專案資料失敗')
    } finally {
        loading.value = false
    }
}

// --- Navigation ---
const navigateToDetail = (project: any, type: 'key' | 'user') => {
    // 跳轉到 detail 頁面
    // 透過 query params 傳遞資料，讓 detail.vue 知道要顯示哪個專案的什麼資訊
    router.push({
        path: '/dashboard/detail',
        query: {
            codename: project.codename,
            projectname: project.projectname,
            type: type
        }
    })
}

// --- Lifecycle Hooks ---
onMounted(() => {
  fetchProjects() 
})

</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  padding: 20px; 
  height: 120px; 
  display: flex;
  flex-direction: column;
  justify-content: center; 
}

.info-card {
  background-color: #f4f4f5;
  color: #909399;
}

.info-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.stat-value {
  font-size: 2.5em; 
  margin-top: 5px; 
  font-weight: bold;
  line-height: 1.2; 
  color: #409eff;
}

h3 {
  margin: 0 0 10px; 
  color: #606266;
  font-size: 1em; 
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>