<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth' // *** 引入 Auth Store ***

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore() // *** 獲取 Auth Store 實例 ***
const search = ref('')
const users = ref<any[]>([])
const loading = ref(false)

// 取得所有使用者
const fetchUsers = async () => {
  try {
    loading.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      // *** 修正：應返回或跳轉 ***
      router.push('/login')
      return
    }

    const res = await axios.get('http://localhost:8000/users/get_all', {
      headers: { Authorization: `Bearer ${savedToken}` }
    })

    if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
      users.value = res.data.data
    } else {
      console.error('回傳格式不正確:', res.data)
      ElMessage.warning('使用者資料格式不正確')
    }
  } catch (err) {
    console.error("無法取得使用者列表:", err) // 添加錯誤詳情
    ElMessage.error('無法取得使用者列表')
  } finally {
    loading.value = false
  }
}

// 搜尋功能 (僅針對 Username 和 Role)
const filteredUsers = computed(() => {
  const query = search.value.toLowerCase().trim() // 添加 trim()
  if (!query) return users.value; // 無搜尋時返回全部

  return users.value.filter(u =>
    u.username?.toLowerCase().includes(query) ||
    u.role?.toLowerCase().includes(query)
  )
})

// 點擊查看詳細
const handleViewDetail = (row: any) => {
  // 檢查 username 是否存在
  if (!row.username) {
     ElMessage.warning('無法獲取使用者名稱');
     return;
  }
  router.push({ path: '/account/account1', query: { username: row.username } })
}

// 點擊新增
const handleCreate = () => {
  router.push('/account/account2')
}

// 點擊刪除
const handleDelete = async (row: any) => {
   // 再次檢查是否刪除自己 (雖然按鈕已禁用，多一層保險)
   if (row.username === auth.user?.username) {
      ElMessage.warning('不能刪除您自己的帳號');
      return;
   }

  try {
    await ElMessageBox.confirm(
      `確定要刪除使用者 "${row.username}" 嗎？`,
      '警告', // 標題改為警告
      {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    loading.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('登入憑證已過期，請重新登入')
      loading.value = false
      return
    }

    const payload = { username: row.username }

    const res = await axios.delete('http://localhost:8000/users/delete', {
      headers: { Authorization: `Bearer ${savedToken}` },
      data: payload
    })

    if (res.data && res.data.code === 200) {
      ElMessage.success('使用者刪除成功')
      fetchUsers() // 重新載入列表
    } else {
      ElMessage.error(res.data.message || '刪除失敗')
    }
  } catch (err: any) {
    if (err !== 'cancel') { // 用戶點擊取消時，err 會是 'cancel' 字串
      console.error("刪除時發生錯誤:", err)
      let errorMsg = '刪除時發生錯誤';
      if (err.response) {
          if (err.response.status === 401) {
              errorMsg = '權限不足或登入逾時，請重新登入';
          } else {
              errorMsg = err.response.data?.message || `請求失敗: ${err.response.status}`;
          }
      }
      ElMessage.error(errorMsg);
    } else {
        console.log("使用者取消刪除操作"); // 可選的日誌
    }
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div class="account-list-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>帳號管理列表</span>
          <div class="header-right">
            <el-input v-model="search" placeholder="搜尋名稱或權限..." size="small" style="width: 200px; margin-right: 10px;" clearable/>
            <el-button type="primary" @click="handleCreate">新增 User</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="filteredUsers" style="width: 100%" border stripe> 
        <el-table-column prop="username" label="使用者名稱 (UserID)" sortable /> 
        <el-table-column prop="role" label="權限 (Rule)" width="200" sortable />
        <el-table-column label="操作" width="200" align="center">
          <template #default="scope">
            <el-button size="small" type="primary" @click="handleViewDetail(scope.row)">
              查看
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(scope.row)"
              :disabled="scope.row.username === auth.user?.username"
              :title="scope.row.username === auth.user?.username ? '不能刪除您自己的帳號' : ''" 
            >
              刪除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
/* .account-list-page {
  padding: 20px;
} */ /* Padding 已移至 template */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-right {
  display: flex;
  align-items: center;
}
</style>