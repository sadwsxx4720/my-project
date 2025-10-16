import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<{ username: string; email?: string } | null>(null)
  const usersList = ref<any[]>([])
  const router = useRouter()

  // 是否已登入
  const isAuthenticated = computed(() => !!token.value)

  // 登入
  async function login(username: string, password: string) {
    try {
      const formData = new URLSearchParams()
      formData.append('grant_type', 'password')
      formData.append('username', username)
      formData.append('password', password)
      formData.append('scope', '')
      formData.append('client_id', '')
      formData.append('client_secret', '')

      const res = await fetch('http://localhost:8000/jwt/token', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      })

      const data = await res.json()
      console.log('login response:', data)

      if (!data || !data.access_token) {
        throw new Error('登入失敗：未取得 access_token')
      }

      token.value = String(data.access_token)
      user.value = { username }

      // 存入 localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token.value)
        localStorage.setItem('auth_user', JSON.stringify(user.value))
        console.log('localStorage 已儲存 token:', token.value)
      }

      // 登入後呼叫取得使用者列表
      await fetchUsersList()

    } catch (err) {
      console.error('登入錯誤:', err)
      throw err
    }
  }

  // 登出：清空 token、user、localStorage
  function logout() {
    token.value = null
    user.value = null
    usersList.value = []

    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }

    console.log('使用者已登出，狀態已清除')

    // 如果有 router，可以導回登入頁
    try {
      router.push('/login')
    } catch (e) {
      console.warn('router 導向登入頁失敗（可能還沒初始化）')
    }
  }

  // 從 localStorage 載入登入資訊（重新整理時還原狀態）
  function loadToken() {
    if (typeof window === 'undefined') return
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user')

    if (savedToken) token.value = savedToken
    if (savedUser) user.value = JSON.parse(savedUser)
  }

  // ✅ 串接 users/get_all API
  async function fetchUsersList() {
    if (!token.value) {
      console.warn('尚未登入，無法取得使用者列表')
      return
    }

    try {
      const res = await fetch('http://localhost:8000/users/get_all', {
        method: 'GET',
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token.value}`,
        },
      })

      if (!res.ok) {
        throw new Error(`取得使用者列表失敗，狀態碼: ${res.status}`)
      }

      const data = await res.json()
      console.log('users/get_all response:', data)
      usersList.value = data
    } catch (err) {
      console.error('取得使用者列表錯誤:', err)
    }
  }

  return {
    token,
    user,
    usersList,
    isAuthenticated,
    login,       // 新增登入
    logout,      // 新增登出
    loadToken,   // 還原登入狀態
    fetchUsersList,
  }
})
