export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: [
    '@element-plus/nuxt',
    '@pinia/nuxt'
  ],
  css: ['~/assets/css/main.css'],
  elementPlus: {
    importStyle: 'css',
    themes: ['dark']
  },
  vite: {
    ssr: {
      noExternal: ['form-data']
    },
    optimizeDeps: {
      exclude: ['form-data']
    }
  }
})
