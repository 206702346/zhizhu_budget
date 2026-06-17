const cloudApi = require('../../utils/cloud.js')
const { drawPieChart, drawBarChart } = require('../../utils/chart.js')

Page({
  data: {
    income: '0.00',
    expense: '0.00',
    balance: '0.00',
    monthCount: 0,
    recentBills: [],
    categoryStats: [],
    trendData: [],
    showPieChart: false,
    showBarChart: false,
    // 预算
    budgetAmount: 0,
    budgetPercent: 0,
    budgetOver: false,
    budgetRemain: '0.00'
  },

  onShow() {
    this.loadSummary()
  },

  goAdd() {
    wx.switchTab({ url: '/pages/add/add' })
  },

  goList() {
    wx.switchTab({ url: '/pages/list/list' })
  },

  onShareAppMessage() {
    return {
      title: `小账本 · 本月结余 ¥${this.data.balance}，已记录 ${this.data.monthCount} 笔`,
      path: '/pages/home/home'
    }
  },

  onShareTimeline() {
    return {
      title: `小账本 · 本月收支 ¥${this.data.balance}`,
      query: ''
    }
  },

  async loadSummary() {
    wx.showLoading({ title: '加载中' })

    try {
      const app = getApp()
      await app.ensureLogin()

      const currentMonth = this.getCurrentMonth()
      const trendMonths = this.getLastMonths(6)

      // 并行获取
      const [stats, billsResult, budget] = await Promise.all([
        cloudApi.getMonthStats(currentMonth),
        cloudApi.getBills({ pageSize: 3, page: 1 }),
        cloudApi.getBudget(currentMonth).catch(() => null)
      ])

      const trendData = await this.loadTrendData(trendMonths)

      // 计算预算
      let budgetAmount = 0
      let budgetPercent = 0
      let budgetOver = false
      let budgetRemain = '0.00'
      const expense = Number(stats.expense) || 0

      if (budget && Number(budget.amount) > 0) {
        budgetAmount = Number(budget.amount)
        budgetPercent = Math.min(100, Math.round((expense / budgetAmount) * 100))
        budgetOver = expense > budgetAmount
        budgetRemain = (budgetAmount - expense).toFixed(2)
        if (Number(budgetRemain) < 0) budgetRemain = '0.00'
      }

      this.setData({
        income: stats.income,
        expense: stats.expense,
        balance: stats.balance,
        monthCount: stats.count,
        categoryStats: stats.categoryStats || [],
        recentBills: billsResult.list || [],
        trendData,
        showPieChart: (stats.categoryStats || []).length > 0,
        showBarChart: trendData.length > 0,
        budgetAmount,
        budgetPercent,
        budgetOver,
        budgetRemain
      })

      setTimeout(() => {
        this.drawCharts()
      }, 300)
    } catch (err) {
      console.error('加载失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async loadTrendData(months) {
    try {
      const results = await Promise.all(
        months.map(month => cloudApi.getBills({ month, pageSize: 500 }))
      )

      return months.map((month, index) => {
        const bills = results[index].list || []
        let income = 0
        let expense = 0
        bills.forEach(item => {
          const amount = Number(item.amount) || 0
          if (item.type === 'income') income += amount
          else expense += amount
        })
        return { month: month.slice(5), income: income.toFixed(2), expense: expense.toFixed(2) }
      })
    } catch (err) {
      console.error('加载趋势失败:', err)
      return []
    }
  },

  drawCharts() {
    if (this.data.showPieChart) this.drawPie()
    if (this.data.showBarChart) this.drawBar()
  },

  drawPie() {
    const query = wx.createSelectorQuery()
    query.select('#pieCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        drawPieChart(ctx, this.data.categoryStats, canvas.width, canvas.height)
      })
  },

  drawBar() {
    const query = wx.createSelectorQuery()
    query.select('#barCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        drawBarChart(ctx, this.data.trendData, canvas.width, canvas.height)
      })
  },

  getCurrentMonth() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  },

  getLastMonths(n) {
    const months = []
    const d = new Date()
    for (let i = n - 1; i >= 0; i--) {
      const date = new Date(d.getFullYear(), d.getMonth() - i, 1)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      months.push(`${y}-${m}`)
    }
    return months
  }
})
