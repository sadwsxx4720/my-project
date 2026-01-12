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
          <el-tag :type="viewType === 'key' ? 'warning' : 'primary'" class="type-tag">
            {{ viewType === 'key' ? '金鑰詳細資訊' : '人員詳細資訊' }}
          </el-tag>
        </h2>
      </div>
    </div>

    <!-- 1. 新增：專案金鑰狀態圖表區塊 -->
    <el-row :gutter="20" class="chart-row">
      <!-- (1) 此專案全部金鑰 -->
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header-center">專案金鑰總覽</div>
          </template>
          <div class="chart-container">
             <canvas id="projectAllKeysChart"></canvas>
          </div>
        </el-card>
      </el-col>
      
      <!-- (2) 此專案 AWS 金鑰 -->
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header-center">AWS 金鑰狀態</div>
          </template>
          <div class="chart-container">
            <canvas id="projectAwsKeysChart"></canvas>
          </div>
        </el-card>
      </el-col>

      <!-- (3) 此專案 GCP 金鑰 -->
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header-center">GCP 金鑰狀態</div>
          </template>
          <div class="chart-container">
            <canvas id="projectGcpKeysChart"></canvas>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 2. 主要內容區 (列表) -->
    <el-card shadow="never" v-loading="loading" class="content-card">
      
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
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Back } from '@element-plus/icons-vue'
import Chart, { type ChartItem, type ChartConfiguration } from 'chart.js/auto'
import type { ChartDataset } from 'chart.js';

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()

// --- Query Params ---
const codename = computed(() => route.query.codename as string || '')
const projectname = computed(() => route.query.projectname as string || '未命名專案')
const viewType = computed(() => route.query.type as 'key' | 'user') 

// --- State ---
const loading = ref(false)
const projectKeys = ref<any[]>([])
const projectUsers = ref<any[]>([])

// 圖表實例
let chartInstances: Chart[] = []

// --- Methods ---

const goBack = () => {
  router.push('/dashboard')
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString()
}

// 初始化資料 (包含列表與圖表)
const fetchData = async () => {
  if (!codename.value) {
    ElMessage.warning('缺少專案代號')
    return
  }

  loading.value = true
  const token = localStorage.getItem('auth_token')
  const headers = { Authorization: `Bearer ${token}` }

  try {
    // 1. 無論如何都需要 fetch keys 和 clouds 來畫圖表
    const [keysRes, cloudsRes] = await Promise.all([
      axios.get(`http://localhost:8000/keys/get_all?t=${Date.now()}`, { headers }),
      axios.get(`http://localhost:8000/clouds/get_all?t=${Date.now()}`, { headers })
    ])

    let allKeys = []
    let allClouds = []

    if (keysRes.data && (keysRes.data.code === 0 || keysRes.data.code === 200)) {
       allKeys = keysRes.data.data || []
    }
    
    if (cloudsRes.data && (cloudsRes.data.code === 0 || cloudsRes.data.code === 200)) {
       allClouds = cloudsRes.data.data || []
    }

    // 2. 過濾出屬於此專案的金鑰 (用於列表顯示 + 圖表計算)
    const filteredKeys = allKeys.filter((k: any) => k.codename === codename.value)
    
    if (viewType.value === 'key') {
      projectKeys.value = filteredKeys
    }

    // 3. 繪製圖表 (使用過濾後的專案金鑰數據)
    await processAndRenderProjectCharts(filteredKeys, allClouds)

    // 4. 如果是查看人員，需額外打 projects API
    if (viewType.value === 'user') {
      const projRes = await axios.post('http://localhost:8000/projects/get_one', 
        { codename: codename.value },
        { headers }
      )
      if (projRes.data && (projRes.data.code === 0 || projRes.data.code === 200) && projRes.data.data) {
        projectUsers.value = projRes.data.data.projectinfo || []
      }
    }

  } catch (error) {
    console.error('Fetch detail error:', error)
    ElMessage.error('獲取詳細資料失敗')
  } finally {
    loading.value = false
  }
}

// --- Chart Logic ---

const processAndRenderProjectCharts = async (projectKeysData: any[], cloudServices: any[]) => {
    // 建立 Key ID -> Cloud Type 對應表
    const keyCloudMap = new Map<string, string>()

    cloudServices.forEach((service: any) => {
        const type = service.cloud_type
        if (Array.isArray(service.keys)) {
            service.keys.forEach((k: any) => {
                if (k.key_id) keyCloudMap.set(k.key_id, type)
            })
        }
    })

    // 統計數據 (只統計當前專案)
    const stats = {
        all: { active: 0, disabled: 0 },
        aws: { active: 0, disabled: 0 },
        gcp: { active: 0, disabled: 0 }
    }

    projectKeysData.forEach((key: any) => {
        const isActive = key.key_state === 'Active'
        const keyId = key.key_id
        const cloudType = keyCloudMap.get(keyId)

        // 總計
        if (isActive) stats.all.active++
        else stats.all.disabled++

        // 分類
        if (cloudType === 'AWS') {
            if (isActive) stats.aws.active++
            else stats.aws.disabled++
        } else if (cloudType === 'GCP') {
            if (isActive) stats.gcp.active++
            else stats.gcp.disabled++
        }
    })

    await nextTick()
    renderCharts(stats)
}

const renderCharts = (stats: any) => {
    chartInstances.forEach(chart => chart.destroy())
    chartInstances = []

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' as const },
            tooltip: { enabled: true }
        }
    }

    // 自定義中心文字 Plugin
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw(chart: any) {
            const { ctx, chartArea: { top, right, bottom, left, width, height } } = chart;
            ctx.save();
            const total = chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
            
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = '#303133';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const centerX = (left + right) / 2;
            const centerY = (top + bottom) / 2;
            
            ctx.fillText(`${total}`, centerX, centerY - 8);
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#909399';
            ctx.fillText('總數', centerX, centerY + 16);
            ctx.restore();
        }
    }

    const createConfig = (
      active: number,
      disabled: number
    ): ChartConfiguration<'doughnut'> => ({
      type: 'doughnut',
      data: {
        labels: ['啟用 (Active)', '停用 (Disabled)'],
        datasets: [
          {
            data: [active, disabled],
            backgroundColor: ['#67C23A', '#F56C6C'],
            borderWidth: 1,
            cutout: '80%',
          } as ChartDataset<'doughnut', number[]>
        ]
      },
      options: commonOptions,
      plugins: [centerTextPlugin],
    });

    // 1. All Keys
    const ctxAll = document.getElementById('projectAllKeysChart') as HTMLCanvasElement
    if (ctxAll) {
        chartInstances.push(new Chart(ctxAll, createConfig(stats.all.active, stats.all.disabled)))
    }

    // 2. AWS
    const ctxAws = document.getElementById('projectAwsKeysChart') as HTMLCanvasElement
    if (ctxAws) {
        chartInstances.push(new Chart(ctxAws, createConfig(stats.aws.active, stats.aws.disabled)))
    }

    // 3. GCP
    const ctxGcp = document.getElementById('projectGcpKeysChart') as HTMLCanvasElement
    if (ctxGcp) {
        chartInstances.push(new Chart(ctxGcp, createConfig(stats.gcp.active, stats.gcp.disabled)))
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

/* 圖表樣式 */
.chart-row {
  margin-bottom: 20px;
}

.chart-card {
    height: 300px;
    display: flex;
    flex-direction: column;
}

.card-header-center {
    text-align: center;
    font-weight: bold;
    color: #303133;
}

.chart-container {
    position: relative;
    height: 200px;
    width: 100%;
    display: flex;
    justify-content: center;
}

.content-card {
  min-height: 300px;
}
</style>