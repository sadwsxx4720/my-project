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

          <!-- 上方統計卡片 -->
          <el-row :gutter="20" class="stats-row">
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <h3>金鑰總數</h3>
                <div class="stat-value">{{ totalKeys }}</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <h3>即將到期金鑰</h3>
                <div class="stat-value">{{ expiringKeys }}</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <h3>已停用金鑰</h3>
                <div class="stat-value">{{ disabledKeys }}</div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover" class="stat-card">
                <h3>本月執行任務</h3>
                <div class="stat-value">{{ monthlyTasks }}</div>
              </el-card>
            </el-col>
          </el-row>

          <!-- 中間圖表 -->
          <el-row :gutter="20" class="chart-row">
            <el-col :span="12">
              <el-card shadow="hover">
                <h3>金鑰狀態分佈</h3>
                <canvas id="keysChart"></canvas>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="hover">
                <h3>操作紀錄統計</h3>
                <canvas id="logsChart"></canvas>
              </el-card>
            </el-col>
          </el-row>

          <!-- 下方最近通知 -->
          <el-row :gutter="20" class="log-row">
            <el-col :span="24">
              <el-card shadow="hover">
                <h3>最近通知</h3>
                <ul class="log-list">
                  <li v-for="(log, index) in recentLogs" :key="index">
                    <span class="log-time">{{ log.time }}</span>
                    <span class="log-message">{{ log.message }}</span>
                  </li>
                </ul>
              </el-card>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Chart from 'chart.js/auto'

definePageMeta({
  layout: 'default'
})

// 假資料（mock data）
const totalKeys = 125
const expiringKeys = 45
const disabledKeys = 20
const monthlyTasks = 89

const recentLogs = [
  { time: '2025/10/01 12:30', message: '金鑰 abc123 已停用' },
  { time: '2025/09/29 09:15', message: '金鑰 xyz789 已建立' },
  { time: '2025/09/28 16:00', message: '金鑰 def456 已輪替' },
]

onMounted(() => {
  // 金鑰狀態圖表
  new Chart(document.getElementById('keysChart') as HTMLCanvasElement, {
    type: 'pie',
    data: {
      labels: ['有效', '即將到期', '已停用'],
      datasets: [
        {
          data: [totalKeys - expiringKeys - disabledKeys, expiringKeys, disabledKeys],
          backgroundColor: ['#67C23A', '#E6A23C', '#F56C6C']
        }
      ]
    }
  })

  // 操作紀錄統計
  new Chart(document.getElementById('logsChart') as HTMLCanvasElement, {
    type: 'bar',
    data: {
      labels: ['建立', '停用', '輪替', '刪除'],
      datasets: [
        {
          label: '操作次數',
          data: [12, 8, 15, 5],
          backgroundColor: '#409EFF'
        }
      ]
    }
  })
})
</script>

<style scoped>
.dashboard-page {
  padding: 20px;
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
}

.stat-value {
  font-size: 2em;
  color: #409EFF;
  margin-top: 10px;
  font-weight: bold;
}

h3 {
  margin: 0 0 10px;
  color: #606266;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.log-list li {
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
}

.log-time {
  color: #909399;
  font-size: 0.9em;
  margin-right: 10px;
}

.log-message {
  flex: 1;
}
</style>
