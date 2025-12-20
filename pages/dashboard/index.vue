<template>
  <div class="dashboard-page" style="padding: 20px;">
    
    <!-- 1. 頂部：金鑰狀態圓餅圖區塊 -->
    <el-row :gutter="20" class="chart-row">
      <!-- (1) 全部金鑰 -->
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header-center">所有專案金鑰狀態</div>
          </template>
          <div class="chart-container">
             <canvas id="allKeysChart"></canvas>
          </div>
        </el-card>
      </el-col>
      
      <!-- (2) AWS 金鑰 -->
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header-center">AWS 金鑰狀態</div>
          </template>
          <div class="chart-container">
            <canvas id="awsKeysChart"></canvas>
          </div>
        </el-card>
      </el-col>

      <!-- (3) GCP 金鑰 -->
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header>
            <div class="card-header-center">GCP 金鑰狀態</div>
          </template>
          <div class="chart-container">
            <canvas id="gcpKeysChart"></canvas>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 2. 中間：專案總數 (全寬) -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="24">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <h3>專案總數</h3>
            <div class="stat-value">{{ projects.length }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 3. 底部：專案列表表格 -->
    <el-row :gutter="20" class="action-row">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>專案列表</span>
              <el-button circle icon="Refresh" @click="initDashboard" :loading="loading" />
            </div>
          </template>

          <el-skeleton :rows="5" animated v-if="loading" />

          <div v-else>
            <el-table :data="projects" stripe style="width: 100%" border>
                <el-table-column prop="projectname" label="專案名稱" sortable />
                <el-table-column prop="codename" label="專案代號" sortable />
                
                <!-- 操作欄位 -->
                <el-table-column label="詳細資訊" width="350" align="center">
                    <template #default="scope">
                        <div class="action-buttons">
                          <el-button 
                            size="small" 
                            type="warning" 
                            plain 
                            @click="navigateToDetail(scope.row, 'key')"
                          >
                            查看金鑰詳細資訊
                          </el-button>

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
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Refresh, Key, User } from '@element-plus/icons-vue'
import Chart, { type ChartItem, type ChartConfiguration } from 'chart.js/auto'

definePageMeta({
  layout: 'default'
})

const router = useRouter()

// --- Refs ---
const loading = ref(true)
const projects = ref<any[]>([])

// 圖表實例 (用於銷毀重繪)
let chartInstances: Chart[] = []

// --- API & Data Processing Functions ---

// 初始化儀表板資料
const initDashboard = async () => {
    loading.value = true
    try {
        const savedToken = localStorage.getItem('auth_token')
        if (!savedToken) {
            ElMessage.error('尚未登入，請先登入')
            router.push('/login')
            return
        }
        
        const headers = { Authorization: `Bearer ${savedToken}` }

        // 平行呼叫三個 API
        const [projectsRes, keysRes, cloudsRes] = await Promise.all([
            axios.get(`http://localhost:8000/projects/get_all?t=${Date.now()}`, { headers }),
            axios.get(`http://localhost:8000/keys/get_all?t=${Date.now()}`, { headers }),
            axios.get(`http://localhost:8000/clouds/get_all?t=${Date.now()}`, { headers })
        ])

        // 1. 處理專案列表
        if (projectsRes.data?.code === 200 || projectsRes.data?.code === 0) {
            projects.value = projectsRes.data.data || []
        }

        // 2. 處理圖表數據
        // 驗證 keys 和 clouds 資料
        const allKeys = (keysRes.data?.code === 200 || keysRes.data?.code === 0) ? keysRes.data.data : []
        const cloudServices = (cloudsRes.data?.code === 200 || cloudsRes.data?.code === 0) ? cloudsRes.data.data : []

        await processAndRenderCharts(allKeys, cloudServices)

    } catch (err) {
        console.error("Dashboard API Error:", err)
        ElMessage.error('獲取儀表板資料失敗')
    } finally {
        loading.value = false
    }
}

// 處理數據並繪製圖表
const processAndRenderCharts = async (allKeys: any[], cloudServices: any[]) => {
    // 建立 Key ID 對應 Cloud Type 的 Map
    // 格式: { 'key-123': 'AWS', 'key-456': 'GCP' }
    const keyCloudMap = new Map<string, string>()

    cloudServices.forEach((service: any) => {
        const type = service.cloud_type // 'AWS' or 'GCP'
        if (Array.isArray(service.keys)) {
            service.keys.forEach((k: any) => {
                if (k.key_id) {
                    keyCloudMap.set(k.key_id, type)
                }
            })
        }
    })

    // 統計數據容器
    const stats = {
        all: { active: 0, disabled: 0 },
        aws: { active: 0, disabled: 0 },
        gcp: { active: 0, disabled: 0 }
    }

    // 遍歷所有金鑰進行統計
    allKeys.forEach((key: any) => {
        const isActive = key.key_state === 'Active'
        const keyId = key.key_id
        const cloudType = keyCloudMap.get(keyId) // 查表得知是哪個雲

        // 1. 總計
        if (isActive) stats.all.active++
        else stats.all.disabled++

        // 2. 分類統計
        if (cloudType === 'AWS') {
            if (isActive) stats.aws.active++
            else stats.aws.disabled++
        } else if (cloudType === 'GCP') {
            if (isActive) stats.gcp.active++
            else stats.gcp.disabled++
        }
    })

    // 等待 DOM 更新後繪圖
    await nextTick()
    renderCharts(stats)
}

// 繪製三個圖表
const renderCharts = (stats: any) => {
    // 清除舊圖表
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

    // 自定義 Plugin: 在 Doughnut 中心顯示文字
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw(chart: any) {
            const { ctx, chartArea: { top, right, bottom, left, width, height } } = chart;
            ctx.save();
            
            const total = chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
            
            // 繪製數字
            ctx.font = 'bold 24px sans-serif';
            ctx.fillStyle = '#303133';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const centerX = (left + right) / 2;
            const centerY = (top + bottom) / 2;
            
            ctx.fillText(`${total}`, centerX, centerY - 8);
            
            // 繪製 "總數" 標籤
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#909399';
            ctx.fillText('金鑰總數', centerX, centerY + 18);
            
            ctx.restore();
        }
    }

    // Helper: 產生圓餅圖配置
    const createConfig = (active: number, disabled: number): ChartConfiguration => ({
        type: 'doughnut', // 改用 doughnut 圖表
        data: {
            labels: ['啟用 (Active)', '停用 (Disabled)'],
            datasets: [{
                data: [active, disabled],
                backgroundColor: ['#67C23A', '#F56C6C'], // 綠色, 紅色
                borderWidth: 1,
                cutout: '70%' // 設定圓環寬度
            }]
        },
        options: commonOptions,
        plugins: [centerTextPlugin] // 加入自定義 plugin
    })

    // 1. All Keys Chart
    const ctxAll = document.getElementById('allKeysChart') as HTMLCanvasElement
    if (ctxAll) {
        chartInstances.push(new Chart(ctxAll, createConfig(stats.all.active, stats.all.disabled)))
    }

    // 2. AWS Keys Chart
    const ctxAws = document.getElementById('awsKeysChart') as HTMLCanvasElement
    if (ctxAws) {
        chartInstances.push(new Chart(ctxAws, createConfig(stats.aws.active, stats.aws.disabled)))
    }

    // 3. GCP Keys Chart
    const ctxGcp = document.getElementById('gcpKeysChart') as HTMLCanvasElement
    if (ctxGcp) {
        chartInstances.push(new Chart(ctxGcp, createConfig(stats.gcp.active, stats.gcp.disabled)))
    }
}

// --- Navigation ---
const navigateToDetail = (project: any, type: 'key' | 'user') => {
    router.push({
        path: '/dashboard/detail', // 假設您的 detail.vue 路徑是 /dashboard/detail，或是 /detail 請自行對應
        query: {
            codename: project.codename,
            projectname: project.projectname,
            type: type
        }
    })
}

// --- Lifecycle Hooks ---
onMounted(() => {
  initDashboard() 
})

</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header-center {
    text-align: center;
    font-weight: bold;
    font-size: 1.1em;
    color: #303133;
}

.chart-row {
  margin-bottom: 20px;
}

.chart-card {
    height: 350px; /* 固定高度讓圖表整齊 */
    display: flex;
    flex-direction: column;
}

.chart-container {
    position: relative;
    height: 250px; /* 圖表高度 */
    width: 100%;
    display: flex;
    justify-content: center;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  padding: 20px; 
  /* height: 120px; */
  display: flex;
  justify-content: center;
  align-items: center;
}

.stat-content {
    display: flex;
    flex-direction: column;
    align-items: center;
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