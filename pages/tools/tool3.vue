<template>
  <div class="dashboard-page" style="padding: 20px;">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>金鑰統計圖表</span>
              <el-select
                   v-model="selectedCodename"
                   placeholder="選擇專案代號"
                   size="default"
                   style="width: 500px "
                   :disabled="userCodenamesList.length === 0 || loading"
                 >
                   <el-option label="全部專案" value="all"></el-option>
                   <el-option
                     v-for="code in userCodenamesList"
                     :key="code"
                     :label="code"
                     :value="code"
                   />
              </el-select>
            </div>
          </template>

          <el-skeleton :rows="5" animated v-if="loading" />

          <div v-else>
            <el-row :gutter="20" class="stats-row">
              <el-col :span="8">
                <el-card shadow="hover" class="stat-card">
                  <h3>金鑰總數</h3>
                  <div class="stat-value">{{ totalKeys }}</div>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card shadow="hover" class="stat-card">
                  <h3>啟用中</h3>
                  <div class="stat-value" style="color: #67c23a">{{ activeKeys }}</div>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card shadow="hover" class="stat-card">
                  <h3>已停用</h3>
                  <div class="stat-value" style="color: #f56c6c">{{ disabledKeys }}</div>
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="20" class="filter-row chart-filter-row">
              <el-col :span="24">
                <el-select v-model="selectedChart" placeholder="請選擇圖表" size="default" style="width: 100%">
                  <el-option
                    v-for="item in chartOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-col>
            </el-row>

            <el-row :gutter="20" class="chart-row">
              <el-col :span="24">
                <el-card shadow="hover">
                  <div class="chart-container">
                    <canvas id="mainChart"></canvas>
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
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import Chart, { type ChartItem, type ChartData, type ChartOptions } from 'chart.js/auto';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

definePageMeta({ layout: 'default' });

const router = useRouter();
const auth = useAuthStore();
const loading = ref(true); // Initial loading state
const keys = ref<any[]>([]); // Raw keys data from API
const userCodenamesList = ref<string[]>([]); // User's specific codenames
const selectedCodename = ref('all'); // Selected codename filter
const selectedChart = ref('age'); // Selected chart type
Chart.defaults.font.size = 16

const chartOptions = [
  { value: 'age', label: '金鑰建立天數分佈 (長條圖)' },
  { value: 'usage', label: '金鑰活躍度 (點陣圖)' },
  { value: 'status', label: '金鑰啟用/停用比例 (圓餅圖)' }
];
let mainChart: Chart | null = null; // Chart instance holder

// --- Data Fetching ---

// Fetch User Codenames
const fetchUserCodenames = async (): Promise<boolean> => {
    const currentUsername = auth.user?.username;
    if (!currentUsername) {
        ElMessage.error('無法獲取當前用戶資訊，請重新登入');
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
        const res = await axios.post('http://localhost:8000/users/get_one',
            { username: currentUsername },
            { headers: { Authorization: `Bearer ${savedToken}` } }
        );
        if (res.data && res.data.code === 200 && res.data.data && Array.isArray(res.data.data.codename)) {
            userCodenamesList.value = res.data.data.codename;
            selectedCodename.value = 'all'; // Default to 'all'
            console.log('User Codenames fetched:', userCodenamesList.value);
            return true;
        } else {
            console.error('獲取用戶 Codenames 回傳格式不正確:', res.data);
            ElMessage.warning('無法獲取用戶專案代號資訊');
            userCodenamesList.value = [];
            selectedCodename.value = 'all';
            return false;
        }
    } catch (err) {
        console.error("獲取用戶 Codenames 時出錯:", err);
        ElMessage.error('無法獲取用戶專案代號資訊');
        userCodenamesList.value = [];
        selectedCodename.value = 'all';
        return false;
    }
};

// Fetch All Keys Data
const fetchKeys = async (): Promise<boolean> => {
  try {
    const savedToken = localStorage.getItem('auth_token');
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入');
      router.push('/login');
      return false;
    }
    console.log('Fetching keys from API...');
    const res = await axios.get('http://localhost:8000/keys/get_all', {
      headers: { Authorization: `Bearer ${savedToken}` }
    });
    if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
      console.log('Raw API Data (/keys/get_all):', JSON.parse(JSON.stringify(res.data.data)));
      keys.value = res.data.data;
      console.log(`Fetched ${keys.value.length} total keys.`);
      return true;
    } else {
      console.error('金鑰回傳格式不正確:', res.data);
      ElMessage.warning('金鑰資料格式不正確');
      keys.value = [];
      return false;
    }
  } catch (err) {
    console.error("無法取得金鑰資料:", err);
    ElMessage.error('無法取得金鑰資料');
    keys.value = [];
    return false;
  }
};

// --- Computed Properties for Filtering and Stats ---

// Filter keys based on selectedCodename and user permissions (Ensures returns array)
const filteredKeysByCodename = computed<any[]>(() => {
    try {
        const allFetchedKeys = Array.isArray(keys.value) ? keys.value : [];
        const currentSelected = selectedCodename.value;
        const allowedUserCodes = Array.isArray(userCodenamesList.value) ? userCodenamesList.value : [];

        if (currentSelected === 'all') {
            if (allowedUserCodes.length === 0) return [];
            return allFetchedKeys.filter(key => {
                const keyCodes = Array.isArray(key?.codename) ? key.codename : [];
                return keyCodes.some((kc: string) => allowedUserCodes.includes(kc));
            });
        } else {
            return allFetchedKeys.filter(key => {
                const keyCodes = Array.isArray(key?.codename) ? key.codename : [];
                return keyCodes.includes(currentSelected);
            });
        }
    } catch (error) {
        console.error("Error computing filteredKeysByCodename:", error);
        return []; // Return empty array on error
    }
});

// Computed stats based on filtered keys (Safe access to .length)
const totalKeys = computed(() => Array.isArray(filteredKeysByCodename.value) ? filteredKeysByCodename.value.length : 0);
const activeKeys = computed(() => Array.isArray(filteredKeysByCodename.value) ? filteredKeysByCodename.value.filter(k => k.key_state?.toLowerCase() === 'active').length : 0);
const disabledKeys = computed(() => totalKeys.value - activeKeys.value);

// --- Computed Properties for Chart Data ---

// Calculate age groups (Safe iteration)
const computedAgeGroups = computed(() => {
    const groups = { '90天內': 0, '90-180天': 0, '1年以上': 0 };
    const now = Date.now();
    if (Array.isArray(filteredKeysByCodename.value)) {
        filteredKeysByCodename.value.forEach(k => {
          try {
            const createTime = new Date(k.key_create_time).getTime();
            if(isNaN(createTime)) throw new Error(`Invalid create time: ${k.key_create_time}`);
            const daysSince = (now - createTime) / (1000 * 60 * 60 * 24);
            if (daysSince < 90) groups['90天內']++;
            else if (daysSince < 180) groups['90-180天']++;
            else groups['1年以上']++;
          } catch (e) { console.warn(`Skipping age calc for ${k.key_id}:`, e); }
        });
    }
    return groups;
});

// Calculate usage data (Safe iteration, includes null check)
const computedUsageData = computed(() => {
    const data: { x: string; y: number }[] = [];
    const now = Date.now();
    if (Array.isArray(filteredKeysByCodename.value)) {
        filteredKeysByCodename.value.forEach(k => {
          if (k.key_last_time_used) { // Skips null/undefined
            try {
                const lastUsed = new Date(k.key_last_time_used).getTime();
                if (isNaN(lastUsed)) throw new Error(`Invalid last used time: ${k.key_last_time_used}`);
                const diffDays = (now - lastUsed) / (1000 * 60 * 60 * 24);
                if (!isNaN(diffDays)) {
                    data.push({
                        x: k.key_id || k.key_description || 'N/A',
                        y: Math.round(diffDays) >= 0 ? Math.round(diffDays) : 0
                    });
                } else { console.warn(`Skipping usage data for key ${k.key_id}: Invalid date diff.`); }
            } catch (e) { console.warn(`Skipping usage calc for key ${k.key_id}:`, e); }
          }
        });
    }
    console.log('[Debug] Computed Usage Data:', data);
    return data;
});

// Calculate status data
const computedStatusData = computed(() => ({ active: activeKeys.value, disabled: disabledKeys.value }));

// --- Chart Rendering ---

const renderSelectedChart = async () => {
  await nextTick();
  const canvasElement = document.getElementById('mainChart') as HTMLCanvasElement | null;
  if (!canvasElement) { console.error('找不到 #mainChart canvas 元素'); return; }
  const ctx = canvasElement.getContext('2d');
  if (!ctx) { console.error('無法獲取 Canvas 的 2D context'); return; }
  if (mainChart) { mainChart.destroy(); mainChart = null; }
  console.log(`Rendering chart: ${selectedChart.value} for codename: ${selectedCodename.value}`);
  try {
    switch (selectedChart.value) {
      case 'age': drawAgeChart(ctx, computedAgeGroups.value); break;
      case 'usage': drawUsageChart(ctx, computedUsageData.value); break;
      case 'status': drawStatusChart(ctx, computedStatusData.value); break;
    }
  } catch (error) {
    console.error(`繪製圖表 (${selectedChart.value}) 時發生錯誤:`, error);
    ElMessage.error(`繪製 ${selectedChart.value} 圖表失敗`);
  }
};

// --- Chart Drawing Functions ---

const commonChartOptions = { responsive: true, maintainAspectRatio: false };

// Draw Age Chart (Bar)
const drawAgeChart = (ctx: ChartItem, ageData: Record<string, number>): void => {
    if (!ctx || !(ctx instanceof CanvasRenderingContext2D)) { console.error("drawAgeChart: Invalid ctx."); return; }
    const data: ChartData<'bar'> = {
        labels: Object.keys(ageData),
        datasets: [{
          label: '金鑰數量', data: Object.values(ageData),
          backgroundColor: ['#85C1E9', '#F8C471', '#F1948A'],
          borderColor: ['#3498DB', '#F39C12', '#E74C3C'], borderWidth: 1
        }]
    };
    const options: ChartOptions<'bar'> = {
        ...commonChartOptions,
        plugins: { title: { display: true, text: '金鑰建立天數分佈' }, legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '金鑰數量' }, grid: { borderDash: [2, 4], color: '#D0D0D0' } },
          x: { title: { display: true, text: '天數區間' } }
        }
    };
    mainChart = new Chart(ctx, { type: 'bar', data, options });
};

// Draw Usage Chart (Scatter) with Label Truncation
const drawUsageChart = (ctx: ChartItem, usageChartData: { x: string; y: number }[]): void => {
    if (!ctx || !(ctx instanceof CanvasRenderingContext2D) || !ctx.canvas) {
        console.error("drawUsageChart: Invalid canvas context or canvas element.");
        /* ... (繪製錯誤訊息) ... */
        return;
    }
    if (!usageChartData || usageChartData.length === 0) {
        /* ... (空數據處理) ... */
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px Arial"; ctx.fillStyle = "#888"; ctx.textAlign = "center";
        ctx.fillText("沒有可用的活躍度資料", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    const maxDays = Math.max(...usageChartData.map(d => d.y), 0) || 1;
    const backgroundColors = usageChartData.map(d => `hsl(210, 50%, ${90 - (d.y / maxDays * 60)}%)`);
    const borderColors = usageChartData.map(d => `hsl(210, 60%, ${80 - (d.y / maxDays * 60)}%)`);
    const data: ChartData<'scatter'> = {
        datasets: [{
          label: '距離上次使用天數', data: usageChartData,
          backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 2,
          pointRadius: 8, pointHoverRadius: 10
        }]
    };
    const options: ChartOptions<'scatter'> = {
        ...commonChartOptions,
        plugins: { title: { display: true, text: '金鑰活躍度 (點陣圖)' }, legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '距離上次使用天數' }, grid: { borderDash: [2, 4], color: '#D0D0D0' } },
          x: {
            type: 'category', title: { display: true, text: '金鑰 ID' }, grid: { display: false }, offset: true,
            ticks: {
              // *** 截斷標籤 ***
              callback: function(value, index, ticks) {
                const label = this.getLabelForValue(value as number);
                const maxLength = 15; // 設定最大字符數
                if (label && label.length > maxLength) {
                  return label.substring(0, maxLength) + '...'; // 截斷並加 ...
                }
                return label || ''; // 返回原始標籤或空字串
              },
              autoSkip: false // 保持 false 以顯示所有標籤
            }
          }
        }
    };


    mainChart = new Chart(ctx, { type: 'scatter', data, options });
};

// Draw Status Chart (Pie)
const drawStatusChart = (ctx: ChartItem, statusChartData: { active: number; disabled: number }): void => {
    if (!ctx || !(ctx instanceof CanvasRenderingContext2D)) { console.error("drawStatusChart: Invalid ctx."); return; }
    const total = statusChartData.active + statusChartData.disabled;
    const data: ChartData<'pie'> = {
        labels: ['啟用', '停用'],
        datasets: [{
          label: '金鑰狀態', data: [statusChartData.active, statusChartData.disabled],
          backgroundColor: ['#6cb26c', '#dd514c'], borderColor: ['#FFFFFF'], borderWidth: 2, hoverOffset: 4
        }]
    };
    const options: ChartOptions<'pie'> = {
        ...commonChartOptions,
        plugins: {
          title: { display: true, text: '金鑰啟用/停用比例' }, legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.label || ''; if (label) label += ': ';
                const value = context.raw as number;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                return `${label}${value} 筆 (${percentage})`;
              }
            }
          }
        }
    };
    mainChart = new Chart(ctx, { type: 'pie', data, options });
};

// --- Watchers ---
watch([selectedCodename, selectedChart], () => { renderSelectedChart(); });

// --- Lifecycle ---
onMounted(async () => {
    loading.value = true;
    console.log('Component Mounted: Fetching initial data...');
    // 並發獲取數據
    const [userCodesSuccess, keysSuccess] = await Promise.all([
        fetchUserCodenames(),
        fetchKeys()
    ]);
    loading.value = false;
    console.log('Initial data fetching complete.');
    // 只有在成功獲取金鑰後才渲染圖表
    if (keysSuccess) {
         await nextTick(); // 等待 DOM 更新
         renderSelectedChart(); // 初始渲染
    } else {
        console.warn("Skipping initial chart render because key fetching failed.");
    }
});

</script>

<style scoped>
.dashboard-page { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.stats-row { margin-bottom: 20px; }
.stat-card { text-align: center; padding: 15px; height: 130px; }
.stat-value { font-size: 2em; margin-top: 5px; font-weight: bold; line-height: 1.1; }
h3 { margin: 0 0 5px; color: #606266; font-size: 0.9em; }
.filter-row { margin-bottom: 15px; }
.chart-row { margin-top: 0; }
.chart-container {
  position: relative;
  min-width: 60%;
  min-height: 80%;
  max-height: 600px;
  margin: 0 auto; /* 置中 */
  overflow-x: auto; 
  overflow-y: hidden;
}
.chart-container canvas {
    display: block;
    min-height: 200px;
    width: 100%; /* 基於容器寬度 */
}
</style>