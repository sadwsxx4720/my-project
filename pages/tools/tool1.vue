<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

const cloudServices = ref<any[]>([])
const loading = ref(false)
const userCodenamesList = ref<string[]>([])
const selectedCodename = ref<string | null>(null)

// 獲取當前登入使用者的 Codenames
const fetchUserCodenames = async () => {
    const currentUsername = auth.user?.username;
    if (!currentUsername) {
        ElMessage.error('無法獲取當前用戶資訊，請重新登入')
        router.push('/login');
        return false;
    }
    try {
        const savedToken = localStorage.getItem('auth_token')
        if (!savedToken) {
            ElMessage.error('尚未登入，請先登入')
            router.push('/login')
            return false;
        }
        const res = await axios.post('http://localhost:8000/users/get_one',
            { username: currentUsername },
            { headers: { Authorization: `Bearer ${savedToken}` } }
        )
        if (res.data && res.data.code === 200 && res.data.data && Array.isArray(res.data.data.codename)) {
            userCodenamesList.value = res.data.data.codename;
            if (userCodenamesList.value.length > 0) {
                selectedCodename.value = userCodenamesList.value[0];
            } else {
                selectedCodename.value = null;
                ElMessage.info('目前帳號沒有分配任何專案代號')
            }
            return true;
        } else {
            console.error('獲取用戶 Codenames 回傳格式不正確:', res.data)
            ElMessage.warning('無法獲取用戶專案代號資訊')
            userCodenamesList.value = [];
            selectedCodename.value = null;
            return false;
        }
    } catch (err) {
        console.error("獲取用戶 Codenames 時出錯:", err)
        ElMessage.error('無法獲取用戶專案代號資訊')
        userCodenamesList.value = [];
        selectedCodename.value = null;
        return false;
    }
}

// 獲取雲服務資料
const fetchCloudServices = async () => {
  try {
    // loading 狀態由 onMounted 控制
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      router.push('/login')
      return
    }
    const res = await axios.get('http://localhost:8000/clouds/get_all', {
      headers: { Authorization: `Bearer ${savedToken}` }
    })
    if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
      cloudServices.value = res.data.data
    } else {
      console.error('回傳格式不正確:', res.data)
      ElMessage.warning('雲服務資料格式不正確')
      cloudServices.value = [];
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('無法取得雲服務資料')
    cloudServices.value = [];
  }
}

// 過濾邏輯 - 只根據 selectedCodename
const filteredData = computed(() => {
  if (!selectedCodename.value) {
      return [];
  }
  const currentCode = selectedCodename.value;
  return cloudServices.value.filter(service => {
    const serviceCodes = service.codename || [];
    return serviceCodes.includes(currentCode);
  })
})

// 點擊查看詳細，傳遞所有關聯的 key_id
const handleViewDetail = (row: any) => {
  const keyIdsArray = row.key_id || [];
  if (keyIdsArray.length > 0) {
    const keyIdsString = keyIdsArray.join(',');
    router.push({ path: '/tools/tool2', query: { ids: keyIdsString } });
  } else {
    ElMessage.warning('此服務項目沒有關聯的金鑰可供查看');
  }
}

// Helper function to format date or return 'N/A'
const formatDate = (dateString: string | null | undefined) => {
    return dateString ? new Date(dateString).toLocaleString() : 'N/A';
}

onMounted(async () => {
  loading.value = true;
  const userCodesFetched = await fetchUserCodenames();
  if (userCodesFetched) {
      await fetchCloudServices();
  }
  loading.value = false;
})
</script>

<template>
  <div class="cloud-service-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>金鑰列表</span>
          <el-select
            v-model="selectedCodename"
            placeholder="選擇專案代號"
            size="small"
            style="width: 200px"
            :disabled="userCodenamesList.length === 0"
          >
              <el-option
                v-for="code in userCodenamesList"
                :key="code"
                :label="code"
                :value="code"
              />
          </el-select>
        </div>
      </template>

      <div class="table-container">
        <el-table v-loading="loading" :data="filteredData" style="width: 100%">
          <el-table-column prop="cloud_type" label="雲平台類型" width="120" />
          <el-table-column prop="cloud_account_id" label="雲平台ID" width="280" />
          <el-table-column prop="codename" label="專案代號" width="180">
             <template #default="scope">
                {{ (scope.row.codename || []).join(', ') }}
             </template>
          </el-table-column>
          <el-table-column prop="user_account" label="雲平台使用者帳號" width="250" />
           <el-table-column prop="user_create_time" label="帳號創建時間" width="200">
             <template #default="scope">
                {{ formatDate(scope.row.user_create_time) }}
             </template>
           </el-table-column>
          <el-table-column prop="user_permission" label="帳號權限" width="250">
             <template #default="scope">
                {{ (scope.row.user_permission || []).join(', ') }}
             </template>
          </el-table-column>
          <el-table-column prop="user_MFA_enabled" label="MFA啟用" width="100">
             <template #default="scope">
                {{ scope.row.user_MFA_enabled === true ? '是' : (scope.row.user_MFA_enabled === false ? '否' : 'N/A') }}
             </template>
          </el-table-column>
           <el-table-column prop="user_change_password_previous_time" label="前次密碼變更" width="200">
              <template #default="scope">
                 {{ formatDate(scope.row.user_change_password_previous_time) }}
              </template>
           </el-table-column>
           <el-table-column prop="user_change_password_next_time" label="下次密碼變更" width="200">
              <template #default="scope">
                 {{ formatDate(scope.row.user_change_password_next_time) }}
              </template>
           </el-table-column>
          <el-table-column prop="key_id" label="關聯金鑰ID" width="400">
             <template #default="scope">
                <div v-if="scope.row.key_id && scope.row.key_id.length > 0">
                    <div v-for="(id, index) in scope.row.key_id" :key="index">
                        {{ id }}
                    </div>
                </div>
                <span v-else>N/A</span>
             </template>
          </el-table-column>


          <el-table-column label="操作" width="120">
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                @click="handleViewDetail(scope.row)"
                :disabled="!scope.row.key_id || scope.row.key_id.length === 0"
              >
                查看金鑰
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
/* .cloud-service-page {
  padding: 20px;
} */ /* Padding 已移至 template */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.table-container {
  width: 100%;
  overflow-x: auto;
}

/* 重新計算 min-width (加總所有 width)
   120+280+180+250+200+250+100+200+200+300+120 = 2200px
*/
.el-table {
    min-width: 2300px;
}
</style>