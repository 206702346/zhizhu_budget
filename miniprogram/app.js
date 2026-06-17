const { envList } = require('./envList.js')

App({
  globalData: {
    openid: '',
    isLogin: false,
    // 默认分类（在用户未自定义时使用）
    defaultExpenseCategories: ['餐饮', '交通', '购物', '学习', '娱乐', '医疗', '住房', '其他'],
    defaultIncomeCategories: ['生活费', '工资', '奖金', '兼职', '红包', '其他']
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 以上基础库以使用云能力')
      return
    }

    const envId = envList && envList[0] ? envList[0].envId : 'cloud1-d7g2k7k3b1809fd31'

    wx.cloud.init({
      env: envId,
      traceUser: true
    })

    // 自动登录
    this.login()
  },

  // 微信登录，获取 openid
  login() {
    return new Promise((resolve, reject) => {
      // 先检查是否已登录
      if (this.globalData.isLogin && this.globalData.openid) {
        resolve(this.globalData.openid)
        return
      }

      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      }).then((res) => {
        const result = res.result
        if (result && result.success) {
          this.globalData.openid = result.data.openid
          this.globalData.isLogin = true
          console.log('登录成功, openid:', this.globalData.openid)
          resolve(this.globalData.openid)
        } else {
          reject(result)
        }
      }).catch((err) => {
        console.error('登录失败:', err)
        // 即使登录失败也不阻塞使用
        this.globalData.isLogin = true
        resolve('')
      })
    })
  },

  // 确保已登录（供页面调用）
  ensureLogin() {
    if (this.globalData.isLogin && this.globalData.openid) {
      return Promise.resolve(this.globalData.openid)
    }
    return this.login()
  }
})
