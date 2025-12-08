<template>
  <div class="project-management-container">
    
    <!-- ========================================== -->
    <!-- 模式 A: 專案列表 (List View) -->
    <!-- ========================================== -->
    <div v-if="viewMode === 'list'">
      <!-- 1. 頂部區塊：標題與搜尋 -->
      <div class="page-header">
        <h2 class="page-title">專案列表</h2>
        <div class="header-actions">
          <el-input
            v-model="searchQuery"
            placeholder="搜尋專案名稱或代號"
            prefix-icon="Search"
            class="search-input"
            clearable
          />
          <el-button type="primary" @click="openAddProjectModal">
            <el-icon class="el-icon--left"><Plus /></el-icon>
            新增專案
          </el-button>
        </div>
      </div>

      <!-- 2. 專案列表表格 -->
      <el-card shadow="never" class="table-card" v-loading="loadingProjects">
        <el-table :data="filteredProjects" style="width: 100%" stripe>
          <!-- 專案 ID -->
          <el-table-column prop="projectid" label="專案 ID" width="400" sortable />
          <el-table-column prop="projectname" label="專案名稱" sortable />
          <el-table-column prop="codename" label="專案代號" sortable />

          
          
          <!-- 操作 -->
          <el-table-column label="操作" width="350" align="center">
            <template #default="scope">
              <div class="action-buttons">
                <el-button 
                  size="small" 
                  type="primary" 
                  @click="switchToDetailsView(scope.row)"
                >
                  查看專案詳細資訊
                </el-button>
                <el-button 
                  size="small" 
                  type="danger" 
                  @click="deleteProject(scope.row)"
                  :loading="deletingProject === scope.row.projectid"
                >
                  刪除專案
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <!-- ========================================== -->
    <!-- 模式 B: 專案詳細資訊 (Details View) -->
    <!-- 取代原本的 Dialog，直接在頁面呈現 -->
    <!-- ========================================== -->
    <div v-else-if="viewMode === 'details' && currentProject" class="details-view">
      
      <!-- 詳細資訊 Header (包含返回按鈕) -->
      <div class="page-header details-header-bar">
        <div class="left-section">
          <el-button link @click="backToList" class="back-btn">
            <el-icon :size="20"><Back /></el-icon>
            <span class="back-text">返回列表</span>
          </el-button>
          <div class="divider"></div>
          <h2 class="page-title">
            專案名稱：{{ currentProject.projectname }} 
            <span class="subtitle">專案代號：{{ currentProject.codename }}</span>
          </h2>
        </div>
        
        <div class="right-section">
          <el-button type="primary" @click="openAddMemberModal">
            <el-icon class="el-icon--left"><Plus /></el-icon> 
            新增權限 (Admin & Viewer)
          </el-button>
        </div>
      </div>

      <!-- 成員列表表格 -->
      <el-card shadow="never" class="table-card" v-loading="loadingDetails">
        <el-table :data="currentProject.projectinfo" style="width: 100%" border>
          <!-- 加入 sortable 屬性 -->
          <el-table-column prop="username" label="使用者名稱" sortable />
          
          <!-- 加入 prop="projectrole" 與 sortable 屬性以支援排序 -->
          <el-table-column prop="projectrole" label="該專案權限" width="200" align="center" sortable>
            <template #default="scope">
              <el-tag :type="scope.row.projectrole === 'admin' ? 'danger' : 'info'">
                {{ scope.row.projectrole ? scope.row.projectrole.toUpperCase() : 'UNKNOWN' }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 操作欄位置中 -->
          <el-table-column label="操作" width="300" align="center">
            <template #default="scope">
              <div class="action-buttons">
                <!-- Change Role -->
                <el-button 
                  size="small" 
                  :type="scope.row.projectrole === 'admin' ? 'warning' : 'primary'" 
                  plain
                  :loading="updatingUser === scope.row.username"
                  @click="toggleMemberRole(scope.row)"
                >
                  轉為 {{ scope.row.projectrole === 'admin' ? 'Viewer' : 'Admin' }}
                </el-button>
                
                <!-- Remove User -->
                <el-button 
                  size="small" 
                  type="danger" 
                  plain
                  :loading="updatingUser === scope.row.username"
                  @click="removeMember(scope.row)"
                >
                  移除User
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <!-- ========================================== -->
    <!-- Modal 1: 新增專案精靈 (Wizard) -->
    <!-- ========================================== -->
    <el-dialog
      v-model="addProjectVisible"
      title="新增專案"
      width="800px" 
      :close-on-click-modal="false"
      destroy-on-close
      append-to-body
    >
      <el-steps :active="activeStep" finish-status="finish" align-center class="mb-4">
        <el-step title="基本資訊" />
        <el-step title="新增 Admin" />
        <el-step title="新增 Viewer" />
      </el-steps>

      <!-- 步驟 1: 輸入基本資訊 -->
      <div v-if="activeStep === 0" class="step-content">
        <el-form :model="newProjectForm" label-position="top">
          <el-form-item label="輸入名稱" required>
            <el-input v-model="newProjectForm.projectname" />
          </el-form-item>
          <el-form-item label="輸入代號" required>
            <el-input v-model="newProjectForm.codename" />
          </el-form-item>
        </el-form>
      </div>

      <!-- 步驟 2: 新增 Admin -->
      <div v-if="activeStep === 1" class="step-content" v-loading="loadingUsers">
        <p class="step-desc">請勾選此專案的管理者 (Admin)</p>
        <el-table
          :data="availableUsers"
          @selection-change="handleAdminSelection"
          row-key="username"
          height="350"
          border
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="username" label="使用者名稱" />
          <el-table-column prop="email" label="Email" />
        </el-table>
      </div>

      <!-- 步驟 3: 新增 Viewer -->
      <div v-if="activeStep === 2" class="step-content">
        <p class="step-desc">請勾選此專案的檢視者 (Viewer)</p>
        <el-table
          :data="availableViewers"
          @selection-change="handleViewerSelection"
          row-key="username"
          height="350"
          border
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="username" label="使用者名稱" />
          <el-table-column prop="email" label="Email" />
        </el-table>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button v-if="activeStep > 0" @click="prevStep">上一步</el-button>
          <el-button v-if="activeStep < 2" type="primary" @click="nextStep">下一步</el-button>
          <el-button v-if="activeStep === 2" type="primary" :loading="submittingProject" @click="finishAddProject">Finish</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- ========================================== -->
    <!-- Modal 3: 新增專案成員 (在詳細資訊內呼叫) -->
    <!-- ========================================== -->
    <el-dialog
      v-model="addMemberVisible"
      title="新增權限 (Admin / Viewer)"
      width="500px"
      append-to-body
    >
      <p class="mb-2">請選擇使用者並指定權限：</p>
      
      <el-table 
        :data="usersNotInProject" 
        @selection-change="handleAddMemberSelection"
        height="300"
        border
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="username" label="使用者名稱" />
      </el-table>

      <div class="mt-4 flex-row">
        <span>指派權限為：</span>
        <el-radio-group v-model="newMemberRole">
          <el-radio label="admin">Admin</el-radio>
          <el-radio label="viewer">Viewer</el-radio>
        </el-radio-group>
      </div>

      <template #footer>
        <el-button @click="addMemberVisible = false">取消</el-button>
        <el-button type="primary" :loading="updatingMember" @click="confirmAddMembers">確認新增</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onActivated } from 'vue';
import { Search, Plus, ArrowRight, Delete, Back } from '@element-plus/icons-vue'; // 引入 Back icon
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

// --- Type Definitions ---
interface ProjectInfo {
  username: string;
  projectrole: string;
}

interface Project {
  projectid: string;   
  projectname: string;
  codename: string;
  projectinfo: ProjectInfo[];
}

interface UserProject {
  codename: string;
}

interface ApiUser {
  username: string;
  password?: string;
  role: string;
  email: string;
  projects?: UserProject[];
}

// --- State ---
const auth = useAuthStore();
const projects = ref<Project[]>([]);
const allApiUsers = ref<ApiUser[]>([]); 

const loadingProjects = ref(false);
const loadingUsers = ref(false);
const submittingProject = ref(false);
const loadingDetails = ref(false);
// 【修正】使用 updatingUser 來追蹤正在更新的單一使用者狀態
const updatingUser = ref<string | null>(null);
const updatingMember = ref(false);
const deletingProject = ref<string | null>(null);

// 【新增】視圖模式切換 ('list' | 'details')
const viewMode = ref<'list' | 'details'>('list');
const currentProject = ref<Project | null>(null);

const searchQuery = ref('');

// --- Filtered Projects ---
const filteredProjects = computed(() => {
  if (!searchQuery.value) return projects.value;
  const q = searchQuery.value.toLowerCase();
  return projects.value.filter(p => 
    (p.projectname && p.projectname.toLowerCase().includes(q)) || 
    (p.codename && p.codename.toLowerCase().includes(q)) ||
    (p.projectid && String(p.projectid).includes(q))
  );
});

// --- API Functions ---

const fetchProjects = async () => {
  loadingProjects.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('未登入');

    // 加上時間戳記防止快取
    const res = await axios.get(`http://localhost:8000/projects/get_all?t=${new Date().getTime()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
      projects.value = res.data.data;
    } else {
      ElMessage.error(res.data?.message || '獲取專案列表失敗');
    }
  } catch (err: any) {
    console.error(err);
    ElMessage.error('獲取專案列表發生錯誤');
  } finally {
    loadingProjects.value = false;
  }
};

const fetchUsers = async () => {
  loadingUsers.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('未登入');

    const res = await axios.get('http://localhost:8000/users/get_all', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data) {
        if (res.data.code === 0 || res.data.code === 200) {
           if (Array.isArray(res.data.data)) {
               allApiUsers.value = res.data.data;
           } else {
               ElMessage.warning('使用者資料格式異常 (非陣列)');
           }
        } else {
            ElMessage.error(res.data.message || '獲取使用者列表失敗');
        }
    }
  } catch (err: any) {
    console.error(err);
    ElMessage.error('獲取使用者列表發生錯誤');
  } finally {
    loadingUsers.value = false;
  }
};

// 【修正】移除 updateUserApi，前端不再主動呼叫 users/update

const updateProjectApi = async (projectCodename: string, newProjectInfo: ProjectInfo[]) => {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('未登入');

  const payload = {
    codename: projectCodename,
    projectinfo: newProjectInfo
  };

  return await axios.post('http://localhost:8000/projects/update', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

// --- 刪除專案 ---
const deleteProject = async (project: Project) => {
  ElMessageBox.confirm(
    `確定要刪除專案「${project.projectname}」嗎？這將會同步移除所有使用者的專案權限。`,
    '刪除確認',
    { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    deletingProject.value = project.projectid;
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('未登入');

      // 刪除專案，後端應負責同步移除使用者身上的專案代號
      await axios.delete('http://localhost:8000/projects/delete', {
        headers: { Authorization: `Bearer ${token}` },
        params: { projectid: project.projectid } 
      });

      ElMessage.success('專案已刪除');
      await fetchProjects();

    } catch (err: any) {
      console.error(err);
      ElMessage.error('刪除專案失敗');
    } finally {
      deletingProject.value = null;
    }
  });
};


// --- Add Project Wizard State ---
const addProjectVisible = ref(false);
const activeStep = ref(0);
const newProjectForm = reactive({ projectname: '', codename: '' });
const selectedAdmins = ref<ApiUser[]>([]);
const selectedViewers = ref<ApiUser[]>([]);

const availableUsers = computed(() => allApiUsers.value);
const availableViewers = computed(() => {
  const adminUsernames = selectedAdmins.value.map(u => u.username);
  return allApiUsers.value.filter(u => !adminUsernames.includes(u.username));
});

// --- Logic: Add Project Wizard ---
const openAddProjectModal = async () => {
  activeStep.value = 0;
  newProjectForm.projectname = '';
  newProjectForm.codename = '';
  selectedAdmins.value = [];
  selectedViewers.value = [];
  
  addProjectVisible.value = true;
  await fetchUsers();
};

const handleAdminSelection = (val: ApiUser[]) => {
  selectedAdmins.value = val;
};

const handleViewerSelection = (val: ApiUser[]) => {
  selectedViewers.value = val;
};

const nextStep = () => {
  if (activeStep.value === 0) {
    if (!newProjectForm.projectname || !newProjectForm.codename) {
      ElMessage.warning('請填寫完整專案名稱與代號');
      return;
    }
  }
  activeStep.value++;
};

const prevStep = () => {
  activeStep.value--;
};

const finishAddProject = async () => {
  submittingProject.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('未登入');

    const projectCode = newProjectForm.codename;

    const projectinfoPayload = [
      ...selectedAdmins.value.map(u => ({ username: u.username, projectrole: 'admin' })),
      ...selectedViewers.value.map(u => ({ username: u.username, projectrole: 'viewer' }))
    ];

    const projectPayload = {
      projectname: newProjectForm.projectname,
      codename: projectCode,
      projectinfo: projectinfoPayload
    };

    const res = await axios.post('http://localhost:8000/projects/', projectPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 200 || res.status === 201) {
      ElMessage.success('新增專案並更新使用者資料成功！');
      addProjectVisible.value = false;
      await fetchProjects();
    } else {
      ElMessage.error('新增專案失敗');
    }

  } catch (err: any) {
    console.error(err);
    ElMessage.error(err.response?.data?.message || '操作發生錯誤');
  } finally {
    submittingProject.value = false;
  }
};

// --- State: Page Switching Logic ---

// 切換到詳細頁面
const switchToDetailsView = async (project: Project) => {
  loadingProjects.value = true; // 在列表顯示 loading
  try {
    // 1. 重新抓取所有專案 (確保是最新的)
    await fetchProjects();
    
    // 2. 從最新的專案列表中找到當前操作的專案
    const updatedProject = projects.value.find(p => p.projectid === project.projectid);
    
    // 3. 設定 currentProject
    currentProject.value = JSON.parse(JSON.stringify(updatedProject || project));
    
    // 4. 抓取使用者列表以供新增成員使用
    await fetchUsers();

    // 5. 切換視圖
    viewMode.value = 'details';
  } catch (e) {
    console.error("更新專案詳情失敗", e);
    ElMessage.warning("無法獲取最新專案狀態");
  } finally {
    loadingProjects.value = false;
  }
};

// 返回列表
const backToList = async () => {
  viewMode.value = 'list';
  currentProject.value = null;
  // 返回時刷新一次列表，確保看到最新狀態
  await fetchProjects();
};

const toggleMemberRole = async (member: ProjectInfo) => {
  if (!currentProject.value) return;

  updatingUser.value = member.username;
  try {
    const targetMember = currentProject.value.projectinfo.find(m => m.username === member.username);
    if (!targetMember) throw new Error('找不到成員');
    
    const newRole = targetMember.projectrole === 'admin' ? 'viewer' : 'admin';
    targetMember.projectrole = newRole;

    await updateProjectApi(currentProject.value.codename, currentProject.value.projectinfo);

    ElMessage.success(`已更新 ${member.username} 權限為 ${newRole.toUpperCase()}`);
    
    // 更新成功後，重新抓取資料
    await switchToDetailsView(currentProject.value);

  } catch (err: any) {
    console.error(err);
    ElMessage.error('更新權限失敗：' + (err.response?.statusText || err.message));
  } finally {
    updatingUser.value = null;
  }
};

// 【修正】移除成員：只打 projects/update，後端負責同步 users
const removeMember = async (member: ProjectInfo) => {
  ElMessageBox.confirm(
    `確定要將 ${member.username} 移出此專案嗎？`,
    '警告',
    { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    if (!currentProject.value) return;
    // 【修正】使用 correct variable updatingUser
    updatingUser.value = member.username; 

    try {
      // 1. 過濾出移除後的成員列表
      const updatedProjectInfo = currentProject.value.projectinfo
        .filter(m => m.username !== member.username)
        .map(m => ({
          username: m.username,
          projectrole: m.projectrole
        }));

      // 2. 呼叫 projects/update API (後端會自動同步 users)
      await updateProjectApi(currentProject.value.codename, updatedProjectInfo);

      ElMessage.success('移除成員成功');
      
      // 3. 即時刷新資料
      await switchToDetailsView(currentProject.value);

    } catch (error) {
      console.error(error);
      ElMessage.error('移除成員失敗');
    } finally {
      updatingUser.value = null;
    }
  });
};

// --- State: Add Member (Nested Modal) ---
const addMemberVisible = ref(false);
const selectedUsersToAdd = ref<ApiUser[]>([]);
const newMemberRole = ref<'admin' | 'viewer'>('viewer');

const usersNotInProject = computed(() => {
  if (!currentProject.value || allApiUsers.value.length === 0) return [];
  const currentMemberUsernames = currentProject.value.projectinfo.map(m => m.username);
  return allApiUsers.value.filter(u => !currentMemberUsernames.includes(u.username));
});

const openAddMemberModal = async () => {
  if (allApiUsers.value.length === 0) {
      await fetchUsers();
  }
  selectedUsersToAdd.value = [];
  newMemberRole.value = 'viewer';
  addMemberVisible.value = true;
};

const handleAddMemberSelection = (val: ApiUser[]) => {
  selectedUsersToAdd.value = val;
};

// 【修正】確認新增成員：只打 projects/update，後端負責同步 users
const confirmAddMembers = async () => {
  if (selectedUsersToAdd.value.length === 0) {
    ElMessage.warning('請至少選擇一位使用者');
    return;
  }
  
  if (!currentProject.value) return;

  updatingMember.value = true;
  try {
    const projectCode = currentProject.value.codename;

    // 1. 準備乾淨的現有成員資料
    const existingMembers = currentProject.value.projectinfo.map(m => ({
      username: m.username,
      projectrole: m.projectrole
    }));

    // 2. 準備乾淨的新成員資料
    const newMembers = selectedUsersToAdd.value.map(u => ({
      username: u.username,
      projectrole: newMemberRole.value
    }));

    // 3. 合併列表
    const updatedProjectInfo = [...existingMembers, ...newMembers];
    
    // 4. 呼叫 projects/update API (後端會自動同步)
    await updateProjectApi(projectCode, updatedProjectInfo);

    ElMessage.success('新增成員成功');
    addMemberVisible.value = false;
    
    // 5. 重新抓取資料
    await switchToDetailsView(currentProject.value);

  } catch (err: any) {
    console.error(err);
    ElMessage.error('新增成員失敗');
  } finally {
    updatingMember.value = false;
  }
};

// --- Lifecycle ---
onMounted(() => {
  fetchProjects();
});

onActivated(() => {
  fetchProjects();
});

</script>

<style scoped>
/* 容器樣式 */
.project-management-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

/* Header 區域 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background-color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.details-header-bar {
  /* 詳細資料頁面的 Header 樣式微調 */
}

.left-section {
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

.subtitle {
  font-size: 14px;
  color: #909399;
  font-weight: normal;
  margin-left: 8px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 15px;
}

.search-input {
  width: 250px;
}

/* 表格卡片 */
.table-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
}

/* 按鈕容器 */
.action-buttons {
  display: flex; 
  justify-content: center; 
  gap: 10px;
}

/* 精靈步驟內容 */
.step-content {
  padding: 20px 0;
  min-height: 200px;
}

.step-desc {
  margin-bottom: 10px;
  color: #606266;
  font-size: 14px;
}

.mb-4 {
  margin-bottom: 20px;
}
.mb-2 {
  margin-bottom: 10px;
}
.mt-4 {
  margin-top: 20px;
}

/* 詳細資訊內的小 Header (成員列表字樣) */
.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
}

.details-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.flex-row {
  display: flex;
  align-items: center;
  gap: 15px;
}
</style>