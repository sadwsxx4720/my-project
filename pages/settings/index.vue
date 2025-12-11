<template>
  <div class="settings-page">
    <el-card class="settings-card" shadow="never">
      <el-tabs type="border-card" class="full-height-tabs">
        
        <!-- 分頁 1: 通知設定 -->
        <el-tab-pane class="tab-pane-content">
          <template #label>
            <el-icon><Bell /></el-icon>
            <span>通知設定</span>
          </template>
          
          <div class="notification-settings-container">
            <!-- 1. 通知信箱設定按鈕 (僅 Superuser 可見，靠右) -->
            <div class="top-section" v-if="auth.isSuperuser">
               <el-button type="primary" size="large" @click="goToEmailPage">
                 設定通知信箱
               </el-button>
            </div>

            <el-divider content-position="center">專案成員通知名單設定</el-divider>
            
            <!-- 2. 專案成員勾選區塊 -->
            <div v-loading="loadingMembers" class="member-selection-area">
              <!-- 情況 A: 未選擇專案 -->
              <div v-if="!currentCodename || currentCodename === 'all'" class="empty-block">
                 <el-empty description="請先在上方選擇一個特定專案以設定成員通知" :image-size="100" />
              </div>

              <!-- 情況 B: Viewer 權限 (不可勾選) -->
              <div v-else-if="currentProjectRole === 'viewer' && !auth.isSuperuser" class="empty-block">
                 <el-alert title="您在此專案為 Viewer 權限，無法管理通知名單" type="warning" center :closable="false" show-icon />
              </div>

              <!-- 情況 C: Superuser 或 Admin (可勾選) -->
              <div v-else class="member-list-wrapper">
                 
                 <!-- 列表控制列 -->
                 <div class="list-controls">
                   <span class="role-hint">
                     當前權限: <el-tag size="small" effect="dark">{{ auth.isSuperuser ? 'Superuser' : 'Admin' }}</el-tag>
                   </span>
                   <!-- 下拉式選單 (僅 Superuser 可見) -->
                   <div class="filter-box" v-if="auth.isSuperuser">
                     <span class="label">篩選角色：</span>
                     <el-select v-model="roleFilter" placeholder="全部" size="default" style="width: 150px;">
                       <el-option label="全部 (All)" value="all" />
                       <el-option label="Admin" value="admin" />
                       <el-option label="Viewer" value="viewer" />
                     </el-select>
                   </div>
                 </div>
                 
                 <!-- 條列式呈現 (Table) -->
                 <el-table 
                    ref="memberTableRef"
                    :data="displayedMembers" 
                    style="width: 100%" 
                    border
                    stripe
                    size="large"
                    @selection-change="handleSelectionChange"
                    row-key="username"
                  >
                    <el-table-column type="selection" width="55" align="center" />
                    <el-table-column label="使用者名稱" prop="username" min-width="150" />
                    <el-table-column label="Email" prop="email" min-width="250" />
                    <el-table-column label="角色" prop="projectrole" width="120" align="center">
                      <template #default="scope">
                        <el-tag :type="scope.row.projectrole === 'admin' ? 'danger' : 'info'" effect="plain">
                          {{ scope.row.projectrole.toUpperCase() }}
                        </el-tag>
                      </template>
                    </el-table-column>
                 </el-table>

                 <!-- 儲存按鈕 (置中) -->
                 <div class="action-footer">
                   <el-button type="success" size="large" class="save-btn" @click="saveNotificationMembers">
                     確定更新名單
                   </el-button>
                 </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 分頁 2: 輪替天數設定 -->
        <el-tab-pane class="tab-pane-content rotation-tab">
          <template #label>
            <el-icon><Timer /></el-icon>
            <span>輪替天數設定</span>
          </template>
          
          <!-- 內容水平垂直置中容器 -->
          <div class="rotation-center-wrapper">
             <div class="info-alert">
                <el-alert 
                  title="設定金鑰有效期限，系統將在到期前發出提醒" 
                  type="info" 
                  center
                  :closable="false" 
                  show-icon 
                />
             </div>

             <el-form :model="rotationForm" label-position="top" class="rotation-form">
               <el-form-item label="金鑰輪替天數">
                 <div class="input-with-unit">
                   <el-input-number 
                     v-model="rotationForm.days" 
                     :min="1" 
                     :max="3650"
                     size="large"
                     controls-position="right"
                     style="width: 300px;"
                   />
                   <span class="unit">天</span>
                 </div>
               </el-form-item>

               <el-form-item class="form-btn-item">
                 <el-button type="primary" size="large" class="save-btn" @click="saveRotationSettings">
                   確認送出
                 </el-button>
               </el-form-item>
             </el-form>
          </div>
        </el-tab-pane>

      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Bell, Message, Check, Timer } from '@element-plus/icons-vue'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

// --- State ---
const rotationForm = ref({ days: 365 }) 

// --- Project Members State ---
const loadingMembers = ref(false)
const projectInfo = ref<any[]>([]) 
const allUsers = ref<any[]>([]) // 儲存所有使用者以對應 Email
const currentProjectRole = ref<string>('') 
const selectedMembers = ref<any[]>([]) // 儲存 table 勾選的 rows
const roleFilter = ref('all') // 下拉選單篩選狀態

// --- Computed ---
const currentCodename = computed(() => auth.currentSelectedCodename)
const currentUsername = computed(() => auth.user?.username)

// 1. 合併專案成員與 Email 資訊
const enrichedMembers = computed(() => {
  return projectInfo.value.map(member => {
    const userDetail = allUsers.value.find(u => u.username === member.username)
    return {
      ...member,
      email: userDetail ? userDetail.email : '載入中...'
    }
  })
})

// 2. 根據權限與篩選器過濾顯示列表
const displayedMembers = computed(() => {
  let members = []

  // 權限過濾
  if (auth.isSuperuser) {
    members = enrichedMembers.value
  } else if (currentProjectRole.value === 'admin') {
    members = enrichedMembers.value.filter(m => m.projectrole === 'viewer')
  } else {
    return []
  }

  // 下拉選單篩選 (僅當 Superuser 看得見選單時有效，Admin 因為選單隱藏且上面已過濾，預設 all 沒影響)
  if (roleFilter.value !== 'all') {
    members = members.filter(m => m.projectrole === roleFilter.value)
  }

  return members
})

// --- Methods ---

const goToEmailPage = () => {
  router.push('/settings/email')
}

// 獲取所有使用者 (為了拿 Email)
const fetchAllUsers = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const res = await axios.get('http://localhost:8000/users/get_all', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
      allUsers.value = res.data.data
    }
  } catch (error) {
    console.error('Fetch users error', error)
  }
}

// 獲取專案詳細資訊
const fetchProjectMembers = async (codename: string) => {
  if (!codename || codename === 'all') {
    projectInfo.value = []
    currentProjectRole.value = ''
    return
  }

  loadingMembers.value = true
  try {
    // 確保有 Email 資料
    if (allUsers.value.length === 0) {
      await fetchAllUsers()
    }

    const token = localStorage.getItem('auth_token')
    const res = await axios.post('http://localhost:8000/projects/get_one', 
      { codename: codename },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
      const data = res.data.data
      projectInfo.value = data.projectinfo || []
      
      const myInfo = projectInfo.value.find((m: any) => m.username === currentUsername.value)
      currentProjectRole.value = myInfo ? myInfo.projectrole : 'viewer'
      
      // 此處可根據需求預設勾選某些人，目前重置
    } else {
      projectInfo.value = []
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('無法獲取專案成員資訊')
  } finally {
    loadingMembers.value = false
  }
}

// Table Selection Change
const handleSelectionChange = (val: any[]) => {
  selectedMembers.value = val
}

// --- Save Methods ---

const saveNotificationMembers = () => {
  const selectedNames = selectedMembers.value.map(m => m.username)
  console.log('Selected Members:', selectedNames)
  ElMessage.success(`已更新通知名單，共勾選 ${selectedNames.length} 位成員`)
}

const saveRotationSettings = () => {
  ElMessage.success(`輪替天數設定已更新為 ${rotationForm.value.days} 天`)
}

// --- Watchers ---
watch(currentCodename, (newCode) => {
  if (newCode) {
    fetchProjectMembers(newCode)
  }
}, { immediate: true })

</script>

<style scoped>
.settings-page {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
  box-sizing: border-box;
}

.settings-card {
  min-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}

/* 讓 Tabs 撐滿 */
.full-height-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 600px;
}

.el-tabs :deep(.el-tabs__content) {
  flex: 1;
  padding: 30px; /* 增加內距 */
}

/* Tab 標籤樣式 */
.el-tabs :deep(.el-tabs__item) {
  font-size: 16px;
  height: 50px;
  line-height: 50px;
}

/* --- 通知設定頁面樣式 --- */
.top-section {
  display: flex;
  justify-content: flex-end; /* 改為靠右 */
  margin-bottom: 40px;
}

.list-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.filter-box {
  display: flex;
  align-items: center;
}

.filter-box .label {
  font-size: 14px;
  color: #606266;
  margin-right: 8px;
}

.action-footer {
  margin-top: 40px; /* 增加按鈕與表格的距離 */
  display: flex;
  justify-content: center; /* 儲存按鈕置中 */
}

.save-btn {
  width: 200px;
  font-weight: bold;
  letter-spacing: 1px;
}

/* --- 輪替天數設定頁面樣式 --- */
.rotation-tab {
  height: 100%;
}

.rotation-center-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 400px; /* 確保有足夠高度進行置中 */
  gap: 40px; /* 元件間距加大 */
}

.info-alert {
  width: 100%;
  max-width: 600px;
}

.rotation-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 15px;
}

.unit {
  font-size: 16px;
  color: #606266;
  font-weight: 500;
}

.form-btn-item {
  margin-top: 20px;
}
</style>