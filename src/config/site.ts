export const siteConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  useMockData: import.meta.env.VITE_USE_MOCK !== 'false',
  // 工信部 ICP 备案号：把这里换成你的真实备案号，链接固定指向 beian.miit.gov.cn
  icp: '粤ICP备2026143477号',
  // 公安机关备案号：审核通过后替换为真实号，链接固定指向 beian.mps.gov.cn
  gongan: '粤公网安备 00000000000000号',
}
