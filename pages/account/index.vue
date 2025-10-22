<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
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
    console.error(err)
    ElMessage.error('無法取得使用者列表')
  } finally {
    loading.value = false
  }
}

// 搜尋功能 (僅針對 Username 和 Role)
const filteredUsers = computed(() => {
  const query = search.value.toLowerCase()
  return users.value.filter(u =>
    u.username?.toLowerCase().includes(query) ||
    u.role?.toLowerCase().includes(query)
  )
})

// 點擊查看詳細
const handleViewDetail = (row: any) => {
  router.push({ path: '/account/account1', query: { username: row.username } })
}

// 點擊新增
const handleCreate = () => {
  router.push('/account/account2')
}

// 點擊刪除
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `確定要刪除使用者 "${row.username}" 嗎？`,
      {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    loading.value = true
    
    // *** 修正 1：重新獲取 Token 並檢查 ***
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('登入憑證已過期，請重新登入')
      loading.value = false
      return
    }
    
    const payload = { username: row.username }

    const res = await axios.delete('http://localhost:8000/users/delete', {
      headers: { Authorization: `Bearer ${savedToken}` }, // 確保標頭被送出
      data: payload
    })

    if (res.data && res.data.code === 200) {
      ElMessage.success('使用者刪除成功')
      fetchUsers() // 重新載入列表
    } else {
      ElMessage.error(res.data.message || '刪除失敗')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error(err)
      // 檢查是否為 401 錯誤
      if (err.response && err.response.status === 401) {
        ElMessage.error('權限不足或登入逾時，請重新登入')
      } else {
        ElMessage.error('刪除時發生錯誤')
      }
    }
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div class="account-list-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>帳號管理列表</span>
          <div class="header-right">
            <el-input v-model="search" placeholder="搜尋名稱或權限..." size="small" style="width: 200px; margin-right: 10px;" />
            <el-button type="primary" @click="handleCreate">新增 User</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="filteredUsers" style="width: 100%">
        <el-table-column prop="username" label="使用者名稱 (UserID)" />
        <el-table-column prop="role" label="權限 (Rule)" width="200" />
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" type="primary" @click="handleViewDetail(scope.row)">
              查看
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">
              刪除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
/* *** 修正 5：移除 max-width *** */
.account-list-page {
  padding: 20px;
}
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