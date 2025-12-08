<template>
  <div class="dashboard-page" style="padding: 20px;">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>金鑰統計圖表</span>
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

              <el-col :span="12">
                <el-select
                  v-model="selectedCloudType"
                  placeholder="選擇平台類型"
                  size="small"
                  style="width: 100%"
                  clearable
                  @clear="selectedCloudType = 'all'"
                  :disabled="loading"
                >
                  <el-option
                    v-for="type in availableCloudTypes"
                    :key="type"
                    :label="type === 'all' ? '全部平台' : type"
                    :value="type"
                  />
                </el-select>
              </el-col>

              <el-col :span="12">
                <el-select v-model="selectedChart" placeholder="請選擇圖表" size="small" style="width: 100%" :disabled="loading">
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
const loading = ref(true);
const keys = ref<any[]>([]); // 原始 /keys/get_all 數據
const cloudServices = ref<any[]>([]); // /clouds/get_all 數據
const selectedChart = ref('age');
let mainChart: Chart | null = null;

const selectedCloudType = ref('all'); // Cloud Type 篩選狀態

Chart.defaults.font.size = 14;

const chartOptions = [
  { value: 'age', label: '金鑰建立天數分佈 (長條圖)' },
  { value: 'usage', label: '金鑰活躍度 (點陣圖)' },
  { value: 'rotation', label: '金鑰到期狀態圖 (圓餅圖)' }, 
  { value: 'status', label: '金鑰啟用/停用比例 (圓餅圖)' }
];

// --- Data Fetching ---
const fetchKeys = async (): Promise<boolean> => {
  try {
    const savedToken = localStorage.getItem('auth_token');
    if (!savedToken) { ElMessage.error('尚未登入'); router.push('/login'); return false; }
    console.log('Fetching keys from API...');
    const res = await axios.get('http://localhost:8000/keys/get_all', { headers: { Authorization: `Bearer ${savedToken}` } });
    
    // 【保持】API 狀態碼為 200
    if (res.data?.code === 200 && Array.isArray(res.data.data)) {
      console.log('Raw API Data (/keys/get_all):', JSON.parse(JSON.stringify(res.data.data)));
      keys.value = res.data.data;
      console.log(`Fetched ${keys.value.length} total keys.`);
      return true;
    } else { ElMessage.warning('金鑰資料格式不正確'); keys.value = []; return false; }
  } catch (err) { ElMessage.error('無法取得金鑰資料'); keys.value = []; return false; }
};

// 獲取雲服務資料 (用於 Cloud Type 選單和篩選)
const fetchCloudServices = async (): Promise<boolean> => {
  try {
    const savedToken = localStorage.getItem('auth_token');
    if (!savedToken) { ElMessage.error('尚未登入'); router.push('/login'); return false; }
    const res = await axios.get('http://localhost:8000/clouds/get_all', { headers: { Authorization: `Bearer ${savedToken}` } });
    
    // 【保持】API 狀態碼為 200
    if (res.data?.code === 200 && Array.isArray(res.data.data)) {
      cloudServices.value = res.data.data;
      console.log(`Fetched ${cloudServices.value.length} cloud services.`);
      return true;
    } else { ElMessage.warning('雲服務資料格式不正確'); cloudServices.value = []; return false; }
  } catch (err) { ElMessage.error('無法取得雲服務資料'); cloudServices.value = []; return false; }
};


// --- Computed Properties for Filtering and Stats ---

const availableCloudTypes = computed(() => {
    const types = new Set(cloudServices.value.map(service => service.cloud_type).filter(Boolean));
    return ['all', ...Array.from(types)];
});

// *** 步驟 1：先根據全局 Codename 過濾金鑰 ***
const filteredKeysByCodename = computed<any[]>(() => {
    try {
        const allFetchedKeys = Array.isArray(keys.value) ? keys.value : [];
        const currentSelectedCode = auth.currentSelectedCodename;
        const allowedUserCodes = auth.availableCodename; 

        if (!Array.isArray(allowedUserCodes) || !currentSelectedCode) {
             console.warn("filteredKeysByCodename: Auth data not ready.");
             return [];
        }
        
        if (currentSelectedCode === 'all') {
            if (allowedUserCodes.length === 0) return [];
            // 【修正】key.codename 是字串，檢查是否在允許列表中
            return allFetchedKeys.filter(key => 
                key.codename && allowedUserCodes.includes(key.codename)
            );
        } else {
            // 【修正】key.codename 是字串，直接比對
            return allFetchedKeys.filter(key => 
                key.codename === currentSelectedCode
            );
        }
    } catch (error) { console.error("Error computing filteredKeysByCodename:", error); return []; }
});

// *** 步驟 2：再根據 Cloud Type 過濾 (基於步驟 1 的結果) ***
const filteredKeysByCodenameAndType = computed<any[]>(() => {
    try {
        // 獲取已按 Codename 過濾的金鑰列表
        const codenameFilteredKeys = filteredKeysByCodename.value;
        const currentCloudType = selectedCloudType.value;
        
        console.log(`[Debug Filter] Step 1 (Codename Filtered) Count: ${codenameFilteredKeys.length}`);

        if (currentCloudType === 'all') {
            console.log("[Debug Filter] Step 2: Cloud Type is 'all'. Returning Step 1 results.");
            return codenameFilteredKeys; 
        }

        // *** 反向查找 ***
        // 1. 獲取所有符合選中 Cloud Type 的服務
        const matchingServices = (Array.isArray(cloudServices.value) ? cloudServices.value : [])
            .filter(s => s.cloud_type === currentCloudType);
            
        // 2. 從這些服務中提取所有關聯的 key_id
        const allowedKeyIds = new Set<string>();
        matchingServices.forEach(s => {
            // 【修正】兼容 keys 陣列 (物件) 與 key_id 陣列 (字串) 兩種格式，確保篩選正確
            if (Array.isArray(s.keys)) {
                s.keys.forEach((k: any) => {
                   if (k.key_id) allowedKeyIds.add(k.key_id);
                });
            } else if (Array.isArray(s.key_id)) {
                s.key_id.forEach((id: string) => allowedKeyIds.add(id));
            }
        });
        
        console.log(`[Debug Filter] Step 2 (Cloud Type Filter): Found ${allowedKeyIds.size} allowed key IDs for type "${currentCloudType}".`);

        if (allowedKeyIds.size === 0) {
             console.log("[Debug Filter] Step 3: No keys allowed for this cloud type. Returning [].");
             return [];
        }

        // 3. 過濾已按 Codename 篩選的金鑰，只保留 key_id 在 allowedKeyIds 中的
        const result = codenameFilteredKeys.filter(key => allowedKeyIds.has(key.key_id));
        
        console.log(`[Debug Filter] Step 3 (Intersection): Found ${result.length} keys matching BOTH filters.`);

        return result;

    } catch (error) {
        console.error("Error computing filteredKeysByCodenameAndType:", error);
        return [];
    }
});


const totalKeys = computed(() => Array.isArray(filteredKeysByCodenameAndType.value) ? filteredKeysByCodenameAndType.value.length : 0);
const activeKeys = computed(() => Array.isArray(filteredKeysByCodenameAndType.value) ? filteredKeysByCodenameAndType.value.filter(k => k.key_state?.toLowerCase() === 'active').length : 0);
const disabledKeys = computed(() => totalKeys.value - activeKeys.value);

// --- Computed Properties for Chart Data ---
const computedAgeGroups = computed(() => {
    const groups = { '90天內': 0, '90-180天': 0, '1年以上': 0 }; const now = Date.now();
    if (Array.isArray(filteredKeysByCodenameAndType.value)) {
        filteredKeysByCodenameAndType.value.forEach(k => { try { const createTime = new Date(k.key_create_time).getTime(); if(isNaN(createTime)) return; const daysSince = (now - createTime) / 86400000; if (daysSince < 90) groups['90天內']++; else if (daysSince < 180) groups['90-180天']++; else groups['1年以上']++; } catch (e) { console.warn(`Skipping age calc for ${k.key_id}:`, e); } });
    } return groups;
});
const computedUsageData = computed(() => {
    const data: { x: string; y: number }[] = []; const now = Date.now();
    if (Array.isArray(filteredKeysByCodenameAndType.value)) {
        filteredKeysByCodenameAndType.value.forEach(k => { if (k.key_last_time_used) { try { const lastUsed = new Date(k.key_last_time_used).getTime(); if (isNaN(lastUsed)) return; const diffDays = (now - lastUsed) / 86400000; if (!isNaN(diffDays)) { data.push({ x: k.key_id || k.key_description || 'N/A', y: Math.max(0, Math.round(diffDays)) }); } } catch (e) { console.warn(`Skipping usage calc for key ${k.key_id}:`, e); } } });
    } console.log('[Debug] Computed Usage Data:', data); return data;
});
const computedStatusData = computed(() => ({ active: activeKeys.value, disabled: disabledKeys.value }));

const computedRotationStatusData = computed(() => {
    const groups = {
        '應輪替': 0,
        '即將輪替': 0,
        '不需輪替': 0,
    };
    
    if (Array.isArray(filteredKeysByCodenameAndType.value)) {
        filteredKeysByCodenameAndType.value.forEach(k => {
          const state = k.rotation_state; 
            if (state === 'Valid') { 
                groups['不需輪替']++;
            } else if (state === 'Expiring soon') { 
                groups['即將輪替']++;
            } else if (state === 'Expired') { 
                groups['應輪替']++;
            }
        });
    }
    return groups;
});


// --- Chart Rendering ---
const renderSelectedChart = async () => {
    await nextTick();
    const canvasElement = document.getElementById('mainChart') as HTMLCanvasElement | null;
    if (!canvasElement) { console.error('找不到 #mainChart canvas 元素'); return; }
    
    if (mainChart) { mainChart.destroy(); mainChart = null; }
    // 重置樣式
    canvasElement.style.minWidth = 'auto';
    canvasElement.style.width = '100%';
    canvasElement.style.height = '300px'; 
    
    const ctx = canvasElement.getContext('2d');
    if (!ctx) { console.error('無法獲取 Canvas 的 2D context'); return; }
    
    console.log(`Rendering chart: ${selectedChart.value} for codename: ${auth.currentSelectedCodename}, cloudType: ${selectedCloudType.value}`);
    try {
        switch (selectedChart.value) {
            case 'age': drawAgeChart(ctx, computedAgeGroups.value); break;
            case 'usage': drawUsageChart(ctx, computedUsageData.value); break;
            case 'rotation': drawRotationStatusChart(ctx, computedRotationStatusData.value); break;
            case 'status': drawStatusChart(ctx, computedStatusData.value); break;
        }
    } catch (error) {
        console.error(`繪製圖表 (${selectedChart.value}) 時發生錯誤:`, error);
        ElMessage.error(`繪製 ${selectedChart.value} 圖表失敗`);
    }
};

// --- Chart Drawing Functions ---

const commonChartOptions = { responsive: true, maintainAspectRatio: false };

const drawAgeChart = (ctx: ChartItem, ageData: Record<string, number>): void => {
    if (!ctx || !(ctx instanceof CanvasRenderingContext2D)) { console.error("drawAgeChart: Invalid ctx."); return; }
    
    if (ctx.canvas) {
        ctx.canvas.style.minWidth = 'auto';
        ctx.canvas.style.width = '100%';
        ctx.canvas.style.height = '300px'; 
    }

    const data: ChartData<'bar'> = { labels: Object.keys(ageData), datasets: [{ label: '金鑰數量', data: Object.values(ageData), backgroundColor: ['#85C1E9', '#F8C471', '#F1948A'], borderColor: ['#3498DB', '#F39C12', '#E74C3C'], borderWidth: 1 }] };
    const options: ChartOptions<'bar'> = { ...commonChartOptions, plugins: { title: { display: true, text: '金鑰建立天數分佈' }, legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: '金鑰數量' }, grid: { borderDash: [2, 4], color: '#D0D0D0' } }, x: { title: { display: true, text: '天數區間' } } } };
    mainChart = new Chart(ctx, { type: 'bar', data, options });
};

const drawUsageChart = (ctx: ChartItem, usageChartData: { x: string; y: number }[]): void => {
    if (!ctx || !(ctx instanceof CanvasRenderingContext2D) || !ctx.canvas) {
        console.error("drawUsageChart: Invalid canvas context or canvas element.");
        return;
    }
    if (!usageChartData || usageChartData.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.font = "16px Arial"; ctx.fillStyle = "#888"; ctx.textAlign = "center"; ctx.fillText("沒有可用的活躍度資料", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    const maxDays = Math.max(...usageChartData.map(d => d.y), 0) || 1;
    const backgroundColors = usageChartData.map(d => `hsl(210, 50%, ${90 - (d.y / maxDays * 60)}%)`);
    const borderColors = usageChartData.map(d => `hsl(210, 60%, ${80 - (d.y / maxDays * 60)}%)`);
    const data: ChartData<'scatter'> = { datasets: [{ label: '距離上次使用天數', data: usageChartData, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 2, pointRadius: 8, pointHoverRadius: 10 }] };
    const options: ChartOptions<'scatter'> = {
        ...commonChartOptions,
        plugins: { title: { display: true, text: '金鑰活躍度 (點陣圖)' }, legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '距離上次使用天數' }, grid: { borderDash: [2, 4], color: '#D0D0D0' } },
          x: {
            type: 'category', title: { display: true, text: '金鑰 ID' }, grid: { display: false }, offset: true,
            ticks: {
              callback: function(value, index, ticks) { const label = this.getLabelForValue(value as number); const maxLength = 15; if (label && label.length > maxLength) { return label.substring(0, maxLength) + '...'; } return label || ''; },
              autoSkip: false
            }
          }
        }
    };
    
    const estimatedMinWidth = usageChartData.length * 60 + 100;
    const finalMinWidth = Math.max(600, estimatedMinWidth);
    ctx.canvas.style.minWidth = `${finalMinWidth}px`;
    ctx.canvas.style.width = `${finalMinWidth}px`; 
    ctx.canvas.style.height = '300px';

    mainChart = new Chart(ctx, { type: 'scatter', data, options });
};

const drawStatusChart = (ctx: ChartItem, statusChartData: { active: number; disabled: number }): void => {
    if (!ctx || !(ctx instanceof CanvasRenderingContext2D)) { console.error("drawStatusChart: Invalid ctx."); return; }
    
    if (ctx.canvas) {
        ctx.canvas.style.minWidth = 'auto';
        ctx.canvas.style.width = '100%';
        ctx.canvas.style.height = '300px'; 
    }

    const total = statusChartData.active + statusChartData.disabled;
    const data: ChartData<'pie'> = { labels: ['啟用', '停用'], datasets: [{ label: '金鑰狀態', data: [statusChartData.active, statusChartData.disabled], backgroundColor: ['#6cb26c', '#dd514c'], borderColor: ['#FFFFFF'], borderWidth: 2, hoverOffset: 4 }] };
    const options: ChartOptions<'pie'> = { ...commonChartOptions, plugins: { title: { display: true, text: '金鑰啟用/停用比例' }, legend: { position: 'bottom' }, tooltip: { callbacks: { label: (context) => { let l=context.label||''; if(l)l+=': '; const v=context.raw as number; const p=total>0?((v/total)*100).toFixed(1)+'%':'0%'; return `${l}${v} 筆 (${p})`; } } } } };
    mainChart = new Chart(ctx, { type: 'pie', data, options });
};

const drawRotationStatusChart = (ctx: ChartItem, rotationData: Record<string, number>): void => {
    if (!ctx || !(ctx instanceof CanvasRenderingContext2D)) { console.error("drawRotationStatusChart: Invalid ctx."); return; }
    
    if (ctx.canvas) {
        ctx.canvas.style.minWidth = 'auto';
        ctx.canvas.style.width = '100%';
        ctx.canvas.style.height = '300px'; 
    }

    const labels = Object.keys(rotationData);
    const dataValues = Object.values(rotationData);
    const total = dataValues.reduce((a, b) => a + b, 0);

    const colors = {
        '應輪替': '#F56C6C', 
        '即將輪替': '#E6A23C', 
        '不需輪替': '#67C23A', 
    };

    const data: ChartData<'pie'> = {
        labels: labels,
        datasets: [{
            label: '輪替狀態',
            data: dataValues,
            backgroundColor: labels.map(label => colors[label as keyof typeof colors] || '#909399'),
            borderColor: ['#FFFFFF'],
            borderWidth: 2,
            hoverOffset: 4
        }]
    };
    
    const options: ChartOptions<'pie'> = {
        ...commonChartOptions,
        plugins: {
            title: { display: true, text: '金鑰到期狀態圖' },
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        let label = context.label || '';
                        if (label) label += ': ';
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
watch([() => auth.currentSelectedCodename, selectedCloudType, selectedChart], (newValues, oldValues) => {
    const valuesChanged = JSON.stringify(newValues) !== JSON.stringify(oldValues);
    if (valuesChanged && !loading.value) {
        console.log(`Filters changed, re-rendering chart.`);
        renderSelectedChart();
    }
});

// --- Lifecycle ---
onMounted(async () => {
    loading.value = true;
    console.log('Component Mounted: Fetching initial data...');
    const [keysSuccess, cloudServicesSuccess] = await Promise.all([
        fetchKeys(),
        fetchCloudServices()
    ]);
    loading.value = false;
    console.log('Initial data fetching complete.');
    if (keysSuccess && cloudServicesSuccess) { 
         await nextTick();
         renderSelectedChart();
    } else {
        console.warn("Skipping initial chart render because data fetching failed.");
        if (!keysSuccess) ElMessage.error("初始化金鑰數據失敗");
        if (!cloudServicesSuccess) ElMessage.error("初始化雲服務數據失敗");
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
  height: 350px; 
  margin: 0 auto;
  overflow-x: auto; /* 保留水平滾動 (僅點陣圖會用到) */
  overflow-y: hidden;
}
.chart-container canvas {
    display: block;
    height: 300px !important; /* 強制高度 */
    min-height: 300px !important; /* 強制最小高度 */
    
    width: 100%; 
}
</style>