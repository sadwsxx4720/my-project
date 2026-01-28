<template>
  <div class="project-management-container">

    <div v-if="viewMode === 'list'">
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

      <el-card shadow="never" class="table-card" v-loading="loadingProjects">
        <el-table :data="filteredProjects" style="width: 100%" stripe>
          <el-table-column prop="projectid" label="專案 ID" width="350" sortable />
          <el-table-column prop="projectname" label="專案名稱" sortable />
          <el-table-column prop="codename" label="專案代號" sortable />

          <el-table-column label="母 Key 綁定概況" width="150" align="center">
            <template #default="scope">
              <el-tag v-if="scope.row.mainkeys && scope.row.mainkeys.length > 0" type="success" effect="light">
                已綁定 {{ scope.row.mainkeys.length }} 把
              </el-tag>
              <el-tag v-else type="info" effect="plain">未綁定</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="450" align="center">
            <template #default="scope">
              <div class="action-buttons">
                <el-button
                  size="small"
                  type="success"
                  plain
                  @click="goToKeyDetails(scope.row)"
                >
                  管理綁定母 Key
                </el-button>

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

    <div v-else-if="viewMode === 'details' && currentProject" class="details-view">
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

      <el-card shadow="never" class="table-card" v-loading="loadingDetails">
        <el-table :data="currentProject.projectinfo" style="width: 100%" border>
          <el-table-column prop="username" label="使用者名稱" sortable />
          <el-table-column prop="projectrole" label="該專案權限" width="200" align="center" sortable>
            <template #default="scope">
              <el-tag :type="scope.row.projectrole === 'admin' ? 'danger' : 'info'">
                {{ scope.row.projectrole ? scope.row.projectrole.toUpperCase() : 'UNKNOWN' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="300" align="center">
            <template #default="scope">
              <div class="action-buttons">
                <el-button
                  size="small"
                  :type="scope.row.projectrole === 'admin' ? 'warning' : 'primary'"
                  plain
                  :loading="updatingUser === scope.row.username"
                  @click="toggleMemberRole(scope.row)"
                >
                  轉為 {{ scope.row.projectrole === 'admin' ? 'Viewer' : 'Admin' }}
                </el-button>
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

      <div v-show="activeStep === 0" class="step-content">
        <el-form :model="newProjectForm" label-position="top">
          <el-form-item label="輸入名稱" required>
            <el-input v-model="newProjectForm.projectname" placeholder="請輸入專案名稱" />
          </el-form-item>
          <el-form-item label="輸入代號" required>
            <el-input v-model="newProjectForm.codename" placeholder="請輸入專案代號 (唯一識別碼)" />
          </el-form-item>
          <el-form-item label="輪替天數 (Rotation Days)" required>
            <el-input-number 
              v-model="newProjectForm.rotation" 
              :min="1" 
              placeholder="請輸入天數"
              style="width: 100%;" 
            />
            <small style="color: #909399; margin-top: 5px; display: block;">
              預設為 365 天，此數值將決定 Key 的輪替週期。
            </small>
          </el-form-item>
        </el-form>
      </div>

      <div v-show="activeStep === 1" class="step-content" v-loading="loadingUsers">
        <div class="step-header">
          <p class="step-desc">請勾選此專案的管理者 (Admin)</p>
          <div class="step-header-actions">
            <el-tag type="danger" effect="plain" class="count-tag">
              已選取: {{ selectedAdmins.length }} 人
            </el-tag>
            <el-input
              v-model="searchAdminQuery"
              placeholder="搜尋使用者名稱..."
              prefix-icon="Search"
              size="small"
              style="width: 200px;"
              clearable
            />
          </div>
        </div>
        <el-table
          :data="availableUsers"
          @selection-change="handleAdminSelection"
          row-key="username"
          height="350"
          border
        >
          <el-table-column type="selection" width="55" :reserve-selection="true" />
          <el-table-column prop="username" label="使用者名稱" />
          <el-table-column prop="email" label="Email" />
        </el-table>
      </div>

      <div v-show="activeStep === 2" class="step-content">
        <div class="step-header">
          <p class="step-desc">請勾選此專案的檢視者 (Viewer)</p>
          <div class="step-header-actions">
            <el-tag type="info" effect="plain" class="count-tag">
              已選取: {{ selectedViewers.length }} 人
            </el-tag>
            <el-input
              v-model="searchViewerQuery"
              placeholder="搜尋使用者名稱..."
              prefix-icon="Search"
              size="small"
              style="width: 200px;"
              clearable
            />
          </div>
        </div>
        <el-table
          :data="availableViewers"
          @selection-change="handleViewerSelection"
          row-key="username"
          height="350"
          border
        >
          <el-table-column type="selection" width="55" :reserve-selection="true" />
          <el-table-column prop="username" label="使用者名稱" />
          <el-table-column prop="email" label="Email" />
        </el-table>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button v-if="activeStep > 0" @click="prevStep">上一步</el-button>
          <el-button
            v-if="activeStep < 2"
            type="primary"
            @click="nextStep"
            :disabled="activeStep === 0 && (!newProjectForm.projectname || !newProjectForm.codename || !newProjectForm.rotation)"
          >
            下一步
          </el-button>

          <el-button v-if="activeStep === 2" type="primary" :loading="submittingProject" @click="finishAddProject">確定新增專案</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog
      v-model="addMemberVisible"
      title="新增權限 (Admin & Viewer)"
      width="800px"
      destroy-on-close
      append-to-body
    >
      <div class="modal-content">
        <div class="role-section">
          <div class="step-header">
            <span class="role-label-tag admin-tag">新增 Admin</span>
            <div class="step-header-actions">
              <el-tag type="danger" effect="plain" class="count-tag">
                已選取: {{ selectedAdminsToAdd.length }} 人
              </el-tag>
              <el-input
                v-model="searchAddAdminQuery"
                placeholder="搜尋使用者..."
                prefix-icon="Search"
                size="small"
                style="width: 200px;"
                clearable
              />
            </div>
          </div>
          <el-table
            :data="filteredUsersForAdmin"
            @selection-change="handleAddAdminSelection"
            height="200"
            border
            size="small"
            row-key="username"
          >
            <el-table-column type="selection" width="55" :reserve-selection="true" />
            <el-table-column prop="username" label="使用者名稱" />
            <el-table-column prop="email" label="Email" />
          </el-table>
        </div>

        <el-divider />

        <div class="role-section">
          <div class="step-header">
            <span class="role-label-tag viewer-tag">新增 Viewer</span>
            <div class="step-header-actions">
              <el-tag type="info" effect="plain" class="count-tag">
                已選取: {{ selectedViewersToAdd.length }} 人
              </el-tag>
              <el-input
                v-model="searchAddViewerQuery"
                placeholder="搜尋使用者..."
                prefix-icon="Search"
                size="small"
                style="width: 200px;"
                clearable
              />
            </div>
          </div>
          <el-table
            :data="filteredUsersForViewer"
            @selection-change="handleAddViewerSelection"
            height="200"
            border
            size="small"
            row-key="username"
          >
            <el-table-column type="selection" width="55" :reserve-selection="true" />
            <el-table-column prop="username" label="使用者名稱" />
            <el-table-column prop="email" label="Email" />
          </el-table>
        </div>

      </div>

      <template #footer>
        <el-button @click="addMemberVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="confirmAddMembers"
          :disabled="selectedAdminsToAdd.length === 0 && selectedViewersToAdd.length === 0"
        >
          確定新增
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onActivated } from 'vue';
import { Search, Plus, ArrowRight, Delete, Back, Key } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

const router = useRouter();

// --- Type Definitions ---
interface ProjectInfo {
  username: string;
  projectrole: string;
}

interface MainKey {
  key_id: string;
  key_info: string;
}

interface Project {
  projectid: string;
  projectname: string;
  codename: string;
  mainkeys: MainKey[];
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
const updatingUser = ref<string | null>(null);
const submitting = ref(false);
const deletingProject = ref<string | null>(null);

// 視圖模式切換
const viewMode = ref<'list' | 'details'>('list');
const currentProject = ref<Project | null>(null);

const searchQuery = ref('');

// --- Add Project Wizard Search State ---
const searchAdminQuery = ref('');
const searchViewerQuery = ref('');

// --- Add Member Modal State ---
const addMemberVisible = ref(false);
const selectedAdminsToAdd = ref<ApiUser[]>([]);
const selectedViewersToAdd = ref<ApiUser[]>([]);
const searchAddAdminQuery = ref('');
const searchAddViewerQuery = ref('');

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

    const res = await axios.get(`http://localhost:8000/projects/get_all?t=${new Date().getTime()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
      projects.value = (res.data.data || []).map((p: any) => ({
        ...p,
        mainkeys: Array.isArray(p.mainkeys) ? p.mainkeys : []
      }));
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

const updateProjectApi = async (projectCodename: string, newProjectInfo: ProjectInfo[]) => {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('未登入');

  const payload = {
    codename: projectCodename,
    projectinfo: newProjectInfo
  };

  return await axios.post('http://localhost:8000/projects/update_member', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

// --- 跳轉至詳細頁面邏輯 ---
const goToKeyDetails = (project: Project) => {
  router.push({
    path: '/project/keysdetail',
    query: {
      codename: project.codename,
      projectname: project.projectname
    }
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

      await fetchUsers();

      // 刪除專案 API
      await axios.delete('http://localhost:8000/projects/delete', {
        headers: { Authorization: `Bearer ${token}` },
        data: { codename: project.codename }
      });

      ElMessage.success('專案已刪除並更新相關使用者資料');
      await fetchProjects();
      
      // 【修改處】：刪除後也更新上方選單
      if (typeof auth.updateProjectList === 'function') {
        auth.updateProjectList();
      }

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
const newProjectForm = reactive({ projectname: '', codename: '', rotation: 365 }); 
const selectedAdmins = ref<ApiUser[]>([]);
const selectedViewers = ref<ApiUser[]>([]);

// Available Users for Admin Step (With Filter)
const availableUsers = computed(() => {
  let users = allApiUsers.value.filter(u => u.role !== 'superuser');
  if (searchAdminQuery.value) {
    const q = searchAdminQuery.value.toLowerCase();
    users = users.filter(u => u.username.toLowerCase().includes(q));
  }
  return users;
});

// Available Users for Viewer Step (With Filter + Exclude Admins)
const availableViewers = computed(() => {
  const adminUsernames = selectedAdmins.value.map(u => u.username);
  let users = allApiUsers.value.filter(u => u.role !== 'superuser' && !adminUsernames.includes(u.username));
  if (searchViewerQuery.value) {
    const q = searchViewerQuery.value.toLowerCase();
    users = users.filter(u => u.username.toLowerCase().includes(q));
  }
  return users;
});

// --- Logic: Add Project Wizard ---
const openAddProjectModal = async () => {
  activeStep.value = 0;
  newProjectForm.projectname = '';
  newProjectForm.codename = '';
  newProjectForm.rotation = 365;
  selectedAdmins.value = [];
  selectedViewers.value = [];
  searchAdminQuery.value = '';
  searchViewerQuery.value = '';
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
    if (!newProjectForm.rotation) {
      ElMessage.warning('請填寫輪替天數');
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
      rotation: newProjectForm.rotation,
      mailreceivers: [],
      projectinfo: projectinfoPayload,
      mainkeys: []
    };

    const res = await axios.post('http://localhost:8000/projects/', projectPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 200 || res.status === 201) {
      ElMessage.success('新增專案成功！');
      addProjectVisible.value = false;
      await fetchProjects();
      
      // 【修改處】：新增成功後，呼叫 Store 的更新方法
      if (typeof auth.updateProjectList === 'function') {
        auth.updateProjectList();
      }
      
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
// 切換到詳細頁面 (成員管理)
const switchToDetailsView = async (project: Project) => {
  loadingProjects.value = true;
  try {
    await fetchProjects();
    const updatedProject = projects.value.find(p => p.projectid === project.projectid);
    currentProject.value = JSON.parse(JSON.stringify(updatedProject || project));
    await fetchUsers();
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
  await fetchProjects();
};

// --- Add Member Modal Logic ---

const usersNotInProject = computed(() => {
  if (!currentProject.value || allApiUsers.value.length === 0) return [];
  const currentMemberUsernames = currentProject.value.projectinfo.map(m => m.username);
  return allApiUsers.value.filter(u => u.role !== 'superuser' && !currentMemberUsernames.includes(u.username));
});

const filteredUsersForAdmin = computed(() => {
  let users = usersNotInProject.value;
  if (searchAddAdminQuery.value) {
    const q = searchAddAdminQuery.value.toLowerCase();
    users = users.filter(u => u.username.toLowerCase().includes(q));
  }
  return users;
});

const filteredUsersForViewer = computed(() => {
  const adminUsernames = selectedAdminsToAdd.value.map(u => u.username);
  let users = usersNotInProject.value.filter(u => !adminUsernames.includes(u.username));
  if (searchAddViewerQuery.value) {
    const q = searchAddViewerQuery.value.toLowerCase();
    users = users.filter(u => u.username.toLowerCase().includes(q));
  }
  return users;
});

const openAddMemberModal = async () => {
  addMemberVisible.value = true;
  selectedAdminsToAdd.value = [];
  selectedViewersToAdd.value = [];
  searchAddAdminQuery.value = '';
  searchAddViewerQuery.value = '';
  if (allApiUsers.value.length === 0) {
    await fetchUsers();
  }
};

const handleAddAdminSelection = (val: ApiUser[]) => {
  selectedAdminsToAdd.value = val;
};

const handleAddViewerSelection = (val: ApiUser[]) => {
  selectedViewersToAdd.value = val;
};

const confirmAddMembers = async () => {
  if (!currentProject.value) return;
  submitting.value = true;

  try {
    const projectCode = currentProject.value.codename;

    const existingMembers = currentProject.value.projectinfo.map(m => ({
      username: m.username,
      projectrole: m.projectrole
    }));

    const newAdmins = selectedAdminsToAdd.value.map(u => ({
      username: u.username,
      projectrole: 'admin'
    }));
    const newViewers = selectedViewersToAdd.value.map(u => ({
      username: u.username,
      projectrole: 'viewer'
    }));

    const updatedProjectInfo = [...existingMembers, ...newAdmins, ...newViewers];
    await updateProjectApi(projectCode, updatedProjectInfo);

    ElMessage.success('新增成員成功');
    addMemberVisible.value = false;
    await switchToDetailsView(currentProject.value);

  } catch (err: any) {
    console.error(err);
    ElMessage.error('新增成員失敗');
  } finally {
    submitting.value = false;
  }
};


// 權限變更與移除
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
    await switchToDetailsView(currentProject.value);

  } catch (err: any) {
    console.error(err);
    ElMessage.error('更新權限失敗：' + (err.response?.statusText || err.message));
  } finally {
    updatingUser.value = null;
  }
};

const removeMember = async (member: ProjectInfo) => {
  ElMessageBox.confirm(
    `確定要將 ${member.username} 移出此專案嗎？`,
    '警告',
    { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    if (!currentProject.value) return;
    updatingUser.value = member.username;

    try {
      const updatedProjectInfo = currentProject.value.projectinfo
        .filter(m => m.username !== member.username)
        .map(m => ({
          username: m.username,
          projectrole: m.projectrole
        }));

      await updateProjectApi(currentProject.value.codename, updatedProjectInfo);

      ElMessage.success('移除成員成功');
      await switchToDetailsView(currentProject.value);

    } catch (error) {
      console.error(error);
      ElMessage.error('移除成員失敗');
    } finally {
      updatingUser.value = null;
    }
  });
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

/* Wizard 內部標題與搜尋框容器 */
.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

/* Wizard 右側動作區 (Tag + Search) */
.step-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-tag {
  font-weight: bold;
}

.step-desc {
  margin: 0;
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

/* Modal 內的角色控制與搜尋區 */
.modal-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.role-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-label-tag {
  font-size: 14px;
  font-weight: bold;
  padding: 5px 10px;
  border-radius: 4px;
  color: white;
}

.admin-tag {
  background-color: #f56c6c; /* Danger Red */
}

.viewer-tag {
  background-color: #909399; /* Info Gray */
}
</style>