export const siteConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  useMockData: import.meta.env.VITE_USE_MOCK !== 'false',
}
