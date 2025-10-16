// middleware/auth.global.ts
import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  //僅在 client 端載入 token
  if (typeof window !== 'undefined' && !auth.token) {
    auth.loadToken()
  }

  if (!auth.token && to.path !== '/login') {
    return navigateTo('/login')
  }

  if (auth.token && to.path === '/login') {
    return navigateTo('/dashboard')
  }
})
