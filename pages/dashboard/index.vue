<template>
  <div class="dashboard-page">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>儀表板概覽</span>
            </div>
          </template>

          <el-skeleton :rows="5" animated v-if="loading" />

          <div v-else>
            <el-row :gutter="20" class="stats-row">
              <el-col :span="6">
                <el-card shadow="hover" class="stat-card">
                  <h3>金鑰總數</h3>
                  <div class="stat-value">{{ totalKeys }}</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card shadow="hover" class="stat-card">
                  <h3>即將到期 (30天內)</h3>
                  <div class="stat-value" style="color: #E6A23C;">{{ expiringKeys }}</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card shadow="hover" class="stat-card">
                  <h3>有效金鑰</h3>
                  <div class="stat-value" style="color: #67C23A;">{{ activeKeys }}</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card shadow="hover" class="stat-card">
                  <h3>已停用金鑰</h3>
                  <div class="stat-value" style="color: #F56C6C;">{{ disabledKeys }}</div>
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="20" class="action-row">
              <el-col :span="24">
                <el-card shadow="hover">
                  <h3>即將到期的金鑰 (前 5 筆)</h3>
                  <el-table :data="upcomingExpirations" stripe style="width: 100%">
                      <el-table-column prop="keyInfo" label="金鑰 ID / 描述" />
                      <el-table-column prop="expiryDate" label="到期日期" width="200" sortable />
                      <el-table-column label="操作" width="100">
                          <template #default="scope">
                              <el-button size="small" type="primary" link @click="viewKeyDetail(scope.row.keyId)">查看</el-button>
                          </template>
                      </el-table-column>
                  </el-table>
                  <div style="text-align: right; margin-top: 10px;">
                      <el-link type="primary" @click="navigateToKeyList('expiring')">查看所有即將到期金鑰</el-link>
                  </div>
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
// *** 移除 Chart.js 相關 import ***
// import Chart from 'chart.js/auto'
import { ref, computed, onMounted, nextTick } from 'vue' // 移除了 onBeforeUnmount
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'

definePageMeta({
  layout: 'default'
})

const router = useRouter()

// --- Refs for API data and loading state ---
const loading = ref(true) 
const allKeys = ref<any[]>([]) 
const totalKeys = ref(0)
const expiringKeys = ref(0) // 保持為 0
const activeKeys = ref(0)
const disabledKeys = ref(0)

// --- Mock Data (Table - 待替換) ---
// 假設的即將到期列表數據 (只顯示前 5 筆最快到期的)
const upcomingExpirations = ref([
  { keyId: 'key-abc-123', keyInfo: 'key-abc-123 (主資料庫)', expiryDate: '2025/10/25' },
  { keyId: 'key-def-456', keyInfo: 'key-def-456 (API Gateway)', expiryDate: '2025/10/28' },
  { keyId: 'key-ghi-789', keyInfo: 'key-ghi-789 (舊系統)', expiryDate: '2025/11/02' },
  { keyId: 'key-jkl-012', keyInfo: 'key-jkl-012 (測試環境)', expiryDate: '2025/11/05' },
  { keyId: 'key-mno-345', keyInfo: 'key-mno-345 (報表服務)', expiryDate: '2025/11/10' },
])

// --- Chart Instances (已移除) ---
// let keysStatusChartInstance: Chart | null = null
// let keysExpiryChartInstance: Chart | null = null

// --- Functions ---
const fetchKeyStats = async () => {
    loading.value = true
    try {
        const savedToken = localStorage.getItem('auth_token')
        if (!savedToken) {
            ElMessage.error('尚未登入，請先登入')
            router.push('/login')
            return
        }

        const res = await axios.get('http://localhost:8000/keys/get_all', {
            headers: { Authorization: `Bearer ${savedToken}` }
        })

        if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
            allKeys.value = res.data.data
            totalKeys.value = allKeys.value.length
            activeKeys.value = allKeys.value.filter(
                k => k.key_state?.toLowerCase() === 'active' 
            ).length
            disabledKeys.value = totalKeys.value - activeKeys.value 
            expiringKeys.value = 0 // 保持為 0

            // *** 移除 drawCharts() 呼叫 ***
            // await nextTick() 
            // drawCharts() 

        } else {
            console.error('金鑰資料格式不正確:', res.data)
            ElMessage.warning('金鑰資料格式不正確')
        }
    } catch (err) {
        console.error("無法獲取金鑰數據:", err)
        ElMessage.error('無法獲取金鑰數據')
    } finally {
        loading.value = false
    }
}

// *** drawCharts 函數已移除 ***

// 跳轉到金鑰詳細頁面 (示例)
const viewKeyDetail = (keyId: string) => {
    router.push({ path: '/tools/tool2', query: { id: keyId } });
}

// 跳轉到金鑰列表頁面並帶上篩選條件 (示例)
const navigateToKeyList = (filter: string) => {
     if (filter === 'expiring') {
        router.push({ path: '/tools/tool1', query: { status: 'expiring' } }); 
     }
}

// --- Lifecycle Hooks ---
onMounted(() => {
  fetchKeyStats() 
})

// *** onBeforeUnmount 已移除 ***

</script>

<style scoped>
.dashboard-page {
  /* padding: 20px; */ /* 由 layout 提供 */
}

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
  height: 150px; 
  display: flex;
  flex-direction: column;
  justify-content: center; 
}

.stat-value {
  font-size: 2.5em; 
  margin-top: 5px; 
  font-weight: bold;
  line-height: 1.2; 
}

h3 {
  margin: 0 0 5px; 
  color: #606266;
  font-size: 1em; 
}

/* *** .chart-row 和 .chart-row canvas 樣式已移除 *** */

.action-row { 
  margin-bottom: 20px;
}

.el-table {
    font-size: 0.9em;
}

</style>