<template>
  <div class="settings-page">
    <el-card class="settings-card" shadow="never">
      <el-tabs type="border-card" class="full-height-tabs">
        
        <el-tab-pane class="tab-pane-content">
          <template #label>
            <el-icon><Bell /></el-icon>
            <span>通知設定</span>
          </template>
          
          <div class="notification-settings-container">
            <div class="top-section" v-if="canEdit">
               <el-button 
                 type="primary" 
                 plain 
                 size="large" 
                 @click="openEmailModal"
                 :disabled="!currentCodename || currentCodename === 'all'"
               >
                 設定通知信箱
               </el-button>
            </div>

            <el-divider content-position="center">專案成員通知名單設定</el-divider>
            
            <div v-loading="loadingMembers" class="member-selection-area">
              <div v-if="!currentCodename || currentCodename === 'all'" class="empty-block">
                 <el-empty description="請先在上方選擇一個特定專案以設定成員通知" :image-size="100" />
              </div>

              <div v-else class="member-list-wrapper">
                 
                 <div class="list-controls">
                   <div class="controls-left">
                     <span class="role-hint">
                       當前權限: <el-tag size="small" :type="canEdit ? 'danger' : 'info'" effect="dark">
                         {{ auth.isSuperuser ? 'Superuser' : (currentProjectRole ? currentProjectRole.toUpperCase() : 'UNKNOWN') }}
                       </el-tag>
                     </span>
                     <span v-if="!canEdit" class="viewer-hint">
                     </span>
                   </div>

                   <div class="controls-right">
                     <el-input
                        v-model="searchQuery"
                        placeholder="搜尋名稱、Email 或角色..."
                        prefix-icon="Search"
                        size="default"
                        style="width: 220px;" 
                        clearable
                      />

                      <div class="filter-box">
                        <span class="label">角色：</span>
                        <el-select 
                          v-model="roleFilter" 
                          placeholder="全部角色" 
                          size="default" 
                          style="width: 140px;"
                          clearable
                        >
                          <el-option label="全部" value="all" />
                          <el-option label="Admin" value="admin" />
                          <el-option label="Viewer" value="viewer" />
                          <el-option label="Email" value="email" />
                        </el-select>
                      </div>

                      <div class="filter-box">
                        <span class="label">使用者：</span>
                        <el-select 
                          v-model="userFilter" 
                          placeholder="全部使用者" 
                          size="default" 
                          style="width: 160px;"
                          filterable
                          clearable
                          popper-class="user-select-dropdown"
                        >
                          <el-option label="全部" value="all" />
                          <el-option 
                            v-for="user in filterUserOptions" 
                            :key="user.value" 
                            :label="user.label" 
                            :value="user.value" 
                          />
                        </el-select>
                      </div>
                   </div>
                 </div>
                 
                 <el-table 
                    ref="memberTableRef"
                    :data="displayedMembers" 
                    style="width: 100%" 
                    border 
                    stripe 
                    size="large"
                    @selection-change="handleSelectionChange"
                    row-key="email"
                    :class="['member-table', { 'disable-header-checkbox': !canEdit }]"
                  >
                    <el-table-column 
                      type="selection" 
                      width="95" 
                      align="center" 
                      header-align="center"
                      :selectable="checkSelectable" 
                    />
                    
                    <el-table-column 
                      label="使用者名稱" 
                      prop="username" 
                      min-width="150" 
                      sortable 
                      align="left"
                      header-align="left"
                    >
                      <template #default="scope">
                        <span class="text-content">{{ scope.row.username || '-' }}</span>
                      </template>
                    </el-table-column>
                    
                    <el-table-column 
                      label="Email" 
                      prop="email" 
                      min-width="250" 
                      sortable 
                      align="left"
                      header-align="left"
                    >
                      <template #default="scope">
                        <span class="text-content">{{ scope.row.email }}</span>
                      </template>
                    </el-table-column>
                    
                    <el-table-column 
                      label="角色" 
                      prop="projectrole" 
                      width="150" 
                      align="center" 
                      header-align="center" 
                      sortable
                    >
                      <template #default="scope">
                        <el-tag v-if="scope.row.projectrole === 'admin'" type="danger" effect="plain">ADMIN</el-tag>
                        <el-tag v-else-if="scope.row.projectrole === 'viewer'" type="info" effect="plain">VIEWER</el-tag>
                        <el-tag v-else-if="scope.row.projectrole === 'email'" type="warning" effect="plain">EMAIL</el-tag>
                        <el-tag v-else effect="plain">{{ scope.row.projectrole }}</el-tag>
                      </template>
                    </el-table-column>
                 </el-table>

                 <div class="action-footer" v-if="canEdit">
                   <el-button type="primary" size="large" class="save-btn" @click="saveNotificationMembers">
                     確定更新名單
                   </el-button>
                 </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane class="tab-pane-content" v-if="auth.isSuperuser">
          <template #label>
            <el-icon><Message /></el-icon>
            <span>Mail設定</span>
          </template>
          
          <div class="mail-settings-container">
            <div v-if="!currentCodename || currentCodename === 'all'" class="empty-block">
               <el-empty description="請先在上方選擇一個特定專案以設定信件內容" :image-size="100" />
            </div>

            <div v-else class="mail-form-wrapper" v-loading="loadingMailSettings">
               <el-form :model="mailForm" label-position="top" class="mail-form">
                 <el-form-item label="寄件人信箱 (Mail Sender)">
                   <el-input v-model="mailForm.sender" placeholder="請輸入寄件人信箱" size="large" />
                 </el-form-item>

                 <el-form-item label="SMTP 密碼">
                   <el-input 
                     v-model="mailForm.smtp_pwd" 
                     placeholder="請輸入 SMTP 密碼" 
                     type="password"
                     show-password
                     size="large" 
                   />
                 </el-form-item>

                 <el-form-item label="信件主旨">
                   <el-input v-model="mailForm.subject" placeholder="請輸入信件主旨" size="large" />
                 </el-form-item>

                 <el-form-item label="信件內容">
                   <el-input 
                     v-model="mailForm.content" 
                     type="textarea" 
                     :rows="8" 
                     placeholder="請輸入信件內容模板..." 
                   />
                 </el-form-item>

                 <div class="form-btn-item">
                   <el-button type="primary" size="large" class="save-btn" @click="saveMailSettings">
                     儲存設定
                   </el-button>
                 </div>
               </el-form>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane class="tab-pane-content" v-if="auth.isSuperuser">
          <template #label>
            <el-icon><ChatLineRound /></el-icon>
            <span>Telegram 設定</span>
          </template>
          
          <div class="mail-settings-container">
            <div class="mail-form-wrapper" v-loading="loadingTelegramSettings">
               
               <div style="text-align: center; margin-bottom: 20px;">
                 <el-alert 
                    title="請輸入 Telegram Bot 相關資訊以啟用通知功能" 
                    type="info" 
                    center
                    :closable="false" 
                    show-icon 
                    style="max-width: 600px; margin: 0 auto;"
                  />
               </div>

               <el-form :model="telegramForm" label-position="top" class="mail-form">
                 <el-form-item label="Bot Token">
                   <el-input 
                     v-model="telegramForm.token" 
                     placeholder="請輸入 Telegram Bot Token" 
                     size="large" 
                     show-password
                   />
                 </el-form-item>

                 <el-form-item label="Chat ID">
                   <el-input 
                     v-model="telegramForm.chat_id" 
                     placeholder="請輸入 Chat ID (例如: -123456789)" 
                     size="large" 
                     type="number"
                   />
                 </el-form-item>

                 <div class="form-btn-item">
                   <el-button type="primary" size="large" class="save-btn" @click="saveTelegramSettings">
                     確認送出
                   </el-button>
                 </div>
               </el-form>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane class="tab-pane-content rotation-tab" v-if="auth.isSuperuser">
          <template #label>
            <el-icon><Timer /></el-icon>
            <span>輪替天數設定</span>
          </template>
          
          <div class="rotation-settings-container">
            
            <div v-if="!currentCodename || currentCodename === 'all'" class="empty-block">
               <el-empty description="請先在上方選擇一個特定專案以設定輪替天數" :image-size="100" />
            </div>

            <div v-else class="rotation-center-wrapper">
               <div class="info-alert">
                  <el-alert 
                    title="設定金鑰有效期限，系統將在到期前發出提醒" 
                    type="info" 
                    center
                    :closable="false" 
                    show-icon 
                  />
               </div>

               <div style="text-align: center; margin-bottom: 20px; color: #606266;">
                 當前設定專案：<el-tag>{{ currentCodename }}</el-tag>
               </div>

               <el-form :model="rotationForm" label-position="top" class="rotation-form">
                 <el-form-item label="金鑰輪替天數">
                   <div class="input-with-unit">
                     <el-input-number 
                       v-model="rotationForm.days" 
                       :min="1" 
                       :max="3650"
                       :precision="0"
                       :step="1"
                       size="large"
                       controls-position="right"
                       style="width: 300px;"
                       @keydown="preventNonNumericInput"
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
          </div>
        </el-tab-pane>

      </el-tabs>
    </el-card>

    <el-dialog
      v-model="emailDialogVisible"
      title="設定通知電子郵件"
      width="700px"
      append-to-body
      destroy-on-close
      class="email-dialog"
    >
      <div class="email-dialog-content">
        <el-form 
          ref="emailFormRef"
          :model="emailForm"
          :rules="emailRules"
          label-position="top"
          @submit.prevent
          class="email-form-in-modal"
        >
          <el-form-item label="請輸入 Email" prop="email">
            <el-input 
              v-model="emailForm.email" 
              placeholder="example@domain.com" 
              :prefix-icon="Message"
              clearable
              size="large"
            />
          </el-form-item>

          <el-form-item label="請再次輸入 Email" prop="confirmEmail">
            <el-input 
              v-model="emailForm.confirmEmail" 
              placeholder="請再次確認 Email" 
              :prefix-icon="Message"
              clearable
              size="large"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="emailDialogVisible = false" size="large">取消</el-button>
        <el-button 
          type="primary" 
          :loading="addingEmail" 
          :disabled="!isEmailFormValid"
          @click="handleEmailSubmit"
          size="large"
        >
          確認送出
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'
import { ElMessage, ElTable, type FormInstance, type FormRules } from 'element-plus'
import { Bell, Message, Check, Timer, Search, ChatLineRound } from '@element-plus/icons-vue' // 新增 ChatLineRound Icon

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()
const memberTableRef = ref<InstanceType<typeof ElTable>>()

// --- State ---
const rotationForm = ref({ days: 365 }) 

const loadingMailSettings = ref(false)
const mailForm = ref({
  sender: '',
  smtp_pwd: '',
  subject: '',
  content: ''
})

// --- Telegram Settings State ---
const loadingTelegramSettings = ref(false)
const telegramForm = ref({
  token: '',
  chat_id: '' // 使用字串綁定 input，送出時轉數字
})

// --- Project Members State ---
const loadingMembers = ref(false)
const projectInfo = ref<any[]>([]) 
const allUsers = ref<any[]>([]) 
const currentProjectRole = ref<string>('') 
const selectedMembers = ref<any[]>([]) 
const userFilter = ref('all') 
const roleFilter = ref('all') 
const searchQuery = ref('')    

const mailReceivers = ref<string[]>([])
const combinedList = ref<any[]>([])

// --- Email Modal State ---
const emailDialogVisible = ref(false)
const emailFormRef = ref<FormInstance>()
const addingEmail = ref(false)
const emailForm = reactive({
  email: '',
  confirmEmail: ''
})

// --- Computed ---
const currentCodename = computed(() => auth.currentSelectedCodename)
const currentUsername = computed(() => auth.user?.username)

// 判斷是否擁有編輯權限 (Superuser 或 Project Admin)
const canEdit = computed(() => {
  return auth.isSuperuser || currentProjectRole.value === 'admin'
})

// 篩選使用者下拉選單
const filterUserOptions = computed(() => {
  return combinedList.value.map(m => ({
    label: m.username || m.email,
    value: m.email 
  }))
})

// 篩選後顯示的列表
const displayedMembers = computed(() => {
  let members = combinedList.value

  // 1. 搜尋過濾
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    members = members.filter(m => 
      (m.username && m.username.toLowerCase().includes(q)) || 
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.projectrole && m.projectrole.toLowerCase().includes(q))
    )
  }

  // 2. 使用者下拉選單過濾
  if (userFilter.value && userFilter.value !== 'all') {
    members = members.filter(m => m.email === userFilter.value)
  }

  // 3. 角色下拉選單過濾
  if (roleFilter.value && roleFilter.value !== 'all') {
    members = members.filter(m => m.projectrole === roleFilter.value)
  }

  return members
})

// Email 表單驗證
const isEmailFormValid = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return (
    emailForm.email.trim() !== '' && 
    emailForm.confirmEmail.trim() !== '' && 
    emailRegex.test(emailForm.email) && 
    emailForm.email === emailForm.confirmEmail 
  )
})

const validateConfirmEmail = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('請再次輸入 Email'))
  } else if (value !== emailForm.email) {
    callback(new Error('兩次輸入的 Email 不一致'))
  } else {
    callback()
  }
}

const emailRules = reactive<FormRules>({
  email: [
    { required: true, message: '請輸入 Email', trigger: 'blur' },
    { type: 'email', message: '請輸入正確的 Email 格式', trigger: ['blur', 'change'] }
  ],
  confirmEmail: [
    { validator: validateConfirmEmail, trigger: ['blur', 'change'] }
  ]
})


// --- Methods ---

const openEmailModal = () => {
  emailForm.email = ''
  emailForm.confirmEmail = ''
  emailDialogVisible.value = true
}

const handleEmailSubmit = async () => {
  if (!emailFormRef.value) return
  
  await emailFormRef.value.validate(async (valid) => {
    if (valid) {
      addingEmail.value = true
      try {
        const token = localStorage.getItem('auth_token')
        
        const currentSelectedEmails = selectedMembers.value.map(m => m.email).filter(e => e)

        if (currentSelectedEmails.includes(emailForm.email)) {
             ElMessage.warning('此 Email 已在名單中')
             addingEmail.value = false
             return
        }
        
        const newReceiverList = [...mailReceivers.value, emailForm.email].map(email => ({ email }))

        await axios.post('http://localhost:8000/projects/update_mailreceiver', {
           codename: currentCodename.value,
           mailreceivers: newReceiverList
        }, { headers: { Authorization: `Bearer ${token}` } })
        
        ElMessage.success(`成功新增通知信箱：${emailForm.email}`)
        emailDialogVisible.value = false
        
        if (currentCodename.value) {
          await fetchProjectMembers(currentCodename.value)
        }

      } catch (error) {
        console.error(error)
        ElMessage.error('更新失敗，請稍後再試')
      } finally {
        addingEmail.value = false
      }
    }
  })
}

const preventNonNumericInput = (e: KeyboardEvent) => {
  if (['e', 'E', '+', '-', '.'].includes(e.key)) {
    e.preventDefault();
  }
}

// 勾選權限控制
const checkSelectable = (row: any) => {
  return canEdit.value
}

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

const fetchProjectMembers = async (codename: string) => {
  if (!codename || codename === 'all') {
    projectInfo.value = []
    combinedList.value = []
    currentProjectRole.value = ''
    return
  }

  loadingMembers.value = true
  try {
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
      mailReceivers.value = (data.mailreceivers || []).map((m: any) => m.email) 
      rotationForm.value.days = data.rotation || 365
      
      const myInfo = projectInfo.value.find((m: any) => m.username === currentUsername.value)
      currentProjectRole.value = myInfo ? myInfo.projectrole : 'viewer'

      // 整合資料
      const tempList: any[] = []
      
      projectInfo.value.forEach(member => {
        const userDetail = allUsers.value.find(u => u.username === member.username)
        tempList.push({
          ...member,
          email: userDetail ? userDetail.email : '', 
        })
      })

      mailReceivers.value.forEach(email => {
        const exists = tempList.some(m => m.email === email)
        if (!exists) {
           tempList.push({ username: '', email: email, projectrole: 'email' })
        }
      })

      combinedList.value = tempList

      await nextTick()
      if (memberTableRef.value) {
        memberTableRef.value.clearSelection()
        combinedList.value.forEach(row => {
          if (row.email && mailReceivers.value.includes(row.email)) {
             memberTableRef.value!.toggleRowSelection(row, true)
          }
        })
      }

    } else {
      projectInfo.value = []
      combinedList.value = []
    }
  } catch (error) {
    console.error(error)
    ElMessage.error('獲取專案資料失敗')
  } finally {
    loadingMembers.value = false
  }
}

const handleSelectionChange = (val: any[]) => {
  selectedMembers.value = val
}

const fetchMailSettings = async () => {
  loadingMailSettings.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const res = await axios.get('http://localhost:8000/mail_sender/get', {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
      const data = res.data.data
      mailForm.value = {
        sender: data.mail_sender || '',
        smtp_pwd: data.smtp_pwd || '',
        subject: data.subject || '',
        content: data.content || ''
      }
    }
  } catch (error) {
    console.error('Fetch mail settings error', error)
  } finally {
    loadingMailSettings.value = false
  }
}

// ------------------------------------
// Telegram Settings API Logic
// ------------------------------------
const fetchTelegramSettings = async () => {
  loadingTelegramSettings.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const res = await axios.get('http://localhost:8000/telegram_sender/get', {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
      const data = res.data.data
      telegramForm.value = {
        token: data.token || '',
        chat_id: data.chat_id !== undefined ? data.chat_id : ''
      }
    }
  } catch (error) {
    console.error('Fetch telegram settings error', error)
    ElMessage.error('獲取 Telegram 設定失敗')
  } finally {
    loadingTelegramSettings.value = false
  }
}

const saveTelegramSettings = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    // 將 chat_id 轉換為數字格式
    const payload = {
      token: telegramForm.value.token,
      chat_id: Number(telegramForm.value.chat_id)
    }

    await axios.post('http://localhost:8000/telegram_sender/update', payload, {
      headers: { Authorization: `Bearer ${token}` }
    })

    ElMessage.success('Telegram 設定已儲存')
  } catch (error) {
    console.error(error)
    ElMessage.error('儲存 Telegram 設定失敗')
  }
}

const saveNotificationMembers = async () => {
  const mailReceiverPayload = selectedMembers.value
    .map(m => m.email)
    .filter(email => email) 
    .map(email => ({ email: email })) 

  try {
     const token = localStorage.getItem('auth_token')
     
     await axios.post('http://localhost:8000/projects/update_mailreceiver', {
        codename: currentCodename.value,
        mailreceivers: mailReceiverPayload
     }, { headers: { Authorization: `Bearer ${token}` } })

     ElMessage.success(`已更新通知名單，共 ${mailReceiverPayload.length} 個信箱`)
  } catch (e) {
     console.error(e)
     ElMessage.error('更新失敗')
  }
}

const saveRotationSettings = async () => {
  try {
     const token = localStorage.getItem('auth_token')
     await axios.post('http://localhost:8000/projects/update_rotation', {
        codename: currentCodename.value,
        rotation: rotationForm.value.days,
     }, { headers: { Authorization: `Bearer ${token}` } })
     ElMessage.success(`[${currentCodename.value}] 輪替天數設定已更新為 ${rotationForm.value.days} 天`)
  } catch (e) {
     console.error(e)
     ElMessage.error('更新輪替天數失敗')
  }
}

const saveMailSettings = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const payload = {
      mail_sender: mailForm.value.sender,
      smtp_pwd: mailForm.value.smtp_pwd,
      subject: mailForm.value.subject,
      content: mailForm.value.content
    }

    await axios.post('http://localhost:8000/mail_sender/update', payload, {
      headers: { Authorization: `Bearer ${token}` }
    })

    ElMessage.success('信件內容設定已儲存')
  } catch (error) {
    console.error(error)
    ElMessage.error('儲存信件設定失敗')
  }
}

watch(currentCodename, (newCode) => {
  if (newCode) {
    fetchProjectMembers(newCode)
    searchQuery.value = ''
    userFilter.value = 'all'
    roleFilter.value = 'all' 
  }
}, { immediate: true })

onMounted(() => {
  if (auth.isSuperuser) {
    fetchMailSettings()
    fetchTelegramSettings() // 新增：讀取 Telegram 設定
  }
})

</script>

<style scoped>
/* CSS 禁用表頭全選框：滑鼠點擊無效 + 灰色透明感 */
.disable-header-checkbox :deep(.el-table__header-wrapper .el-table-column--selection .el-checkbox) {
  pointer-events: none;
  cursor: not-allowed;
  opacity: 0.4;
  filter: grayscale(100%);
}

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

.full-height-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 600px;
}

.el-tabs :deep(.el-tabs__content) {
  flex: 1;
  padding: 30px;
}

.el-tabs :deep(.el-tabs__item) {
  font-size: 16px;
  height: 50px;
  line-height: 50px;
}

.top-section {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 40px;
}

.list-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.controls-right {
  display: flex;
  gap: 15px;
  align-items: center;
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

.action-footer, .form-btn-item {
  margin-top: 40px;
  display: flex;
  justify-content: center;
}

.save-btn {
  width: 200px;
  font-weight: bold;
  letter-spacing: 1px;
}

.rotation-tab {
  height: 100%;
}

.rotation-settings-container, .mail-settings-container {
    height: 100%;
}

.empty-block {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    min-height: 300px;
}

.rotation-center-wrapper, .mail-form-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center; 
  align-items: center;      
  height: 100%;
  min-height: 400px;
  gap: 30px;
  width: 100%;
}

.info-alert {
  width: 100%;
  max-width: 600px;
}

.rotation-form, .mail-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 600px; 
}

.rotation-form {
  align-items: center; 
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

:deep(.el-form-item__label) {
  font-weight: 500;
  font-size: 16px;
}

/* 控制下拉選單最大高度 */
:deep(.user-select-dropdown .el-select-dropdown__wrap) {
  max-height: 200px; 
}

/* 確保彈窗內距充足 */
.email-dialog-content {
  padding: 30px 50px;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Modal 內的輸入框間距 */
:deep(.email-form-in-modal .el-form-item) {
  margin-bottom: 40px;
}
</style>