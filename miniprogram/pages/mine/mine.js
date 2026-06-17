const cloudApi = require('../../utils/cloud.js')

Page({
  data: {
    totalCount: 0,
    monthCount: 0,
    monthIncome: '0.00',
    monthExpense: '0.00',
    monthBalance: '0.00',
    // 预算
    budgetAmount: '',
    budgetSaved: 0,
    budgetPercent: 0,
    budgetOver: false,
    budgetMonth: '',
    budgetRemainText: '0.00',
    budgetOverClass: '',
    showBudgetEdit: false,
    budgetInput: '',
    // 分类管理
    expenseCategories: [],
    incomeCategories: [],
    showCategoryEdit: false,
    categoryEditType: 'expense',
    categoryInput: '',
    editingCategories: []
  },

  onShow() {
    this.loadMineStats()
    this.loadBudget()
    this.loadCategories()
  },

  getCurrentMonth() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  },

  async loadMineStats() {
    try {
      const stats = await cloudApi.getOverviewStats()
      this.setData({
        totalCount: stats.totalCount,
        monthCount: stats.monthCount,
        monthIncome: stats.monthIncome,
        monthExpense: stats.monthExpense,
        monthBalance: stats.monthBalance
      })
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  },

  async loadBudget() {
    const month = this.getCurrentMonth()
    try {
      const budget = await cloudApi.getBudget(month)
      if (budget) {
        const saved = Number(budget.amount) || 0
        const expense = Number(this.data.monthExpense) || 0
        const percent = saved > 0 ? Math.min(100, Math.round((expense / saved) * 100)) : 0
        const over = expense > saved && saved > 0
        const remain = Math.max(0, saved - expense).toFixed(2)

        this.setData({
          budgetSaved: saved,
          budgetPercent: percent,
          budgetOver: over,
          budgetAmount: saved.toString(),
          budgetMonth: month,
          budgetRemainText: remain,
          budgetOverClass: over ? 'budget-over' : 'budget-left'
        })
      } else {
        this.setData({
          budgetSaved: 0,
          budgetPercent: 0,
          budgetOver: false,
          budgetAmount: '',
          budgetMonth: month,
          budgetRemainText: '0.00',
          budgetOverClass: ''
        })
      }
    } catch (err) {
      console.error('加载预算失败:', err)
    }
  },

  async loadCategories() {
    const app = getApp()
    try {
      const categories = await cloudApi.getCategories()
      if (categories && categories.length > 0) {
        this.setData({
          expenseCategories: categories.filter(c => c.type === 'expense').sort((a, b) => a.sort - b.sort).map(c => c.name),
          incomeCategories: categories.filter(c => c.type === 'income').sort((a, b) => a.sort - b.sort).map(c => c.name)
        })
      } else {
        this.setData({
          expenseCategories: [...app.globalData.defaultExpenseCategories],
          incomeCategories: [...app.globalData.defaultIncomeCategories]
        })
      }
    } catch (err) {
      this.setData({
        expenseCategories: [...app.globalData.defaultExpenseCategories],
        incomeCategories: [...app.globalData.defaultIncomeCategories]
      })
    }
  },

  // ========== 预算 ==========

  openBudgetEdit() {
    this.setData({ showBudgetEdit: true, budgetInput: this.data.budgetAmount || '' })
  },

  closeBudgetEdit() {
    this.setData({ showBudgetEdit: false })
  },

  onBudgetInput(e) {
    this.setData({ budgetInput: e.detail.value })
  },

  async saveBudget() {
    const amount = Number(this.data.budgetInput)
    if (Number.isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '请输入有效预算金额', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      await cloudApi.setBudget(this.getCurrentMonth(), amount)
      wx.showToast({ title: '预算设置成功', icon: 'success' })
      this.setData({ showBudgetEdit: false, budgetSaved: amount, budgetAmount: amount.toString() })
      const expense = Number(this.data.monthExpense) || 0
      this.setData({
        budgetPercent: Math.min(100, Math.round((expense / amount) * 100)),
        budgetOver: expense > amount,
        budgetRemainText: Math.max(0, amount - expense).toFixed(2),
        budgetOverClass: expense > amount ? 'budget-over' : 'budget-left'
      })
    } catch (err) {
      console.error('保存预算失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // ========== 分类管理 ==========

  openCategoryEdit(e) {
    const type = e.currentTarget.dataset.type
    const categories = type === 'expense'
      ? [...this.data.expenseCategories]
      : [...this.data.incomeCategories]

    this.setData({
      showCategoryEdit: true,
      categoryEditType: type,
      editingCategories: categories,
      categoryInput: ''
    })
  },

  closeCategoryEdit() {
    this.setData({ showCategoryEdit: false })
  },

  onCategoryInput(e) {
    this.setData({ categoryInput: e.detail.value })
  },

  addCategory() {
    const name = this.data.categoryInput.trim()
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }
    if (this.data.editingCategories.includes(name)) {
      wx.showToast({ title: '分类已存在', icon: 'none' })
      return
    }
    const editingCategories = [...this.data.editingCategories, name]
    this.setData({ editingCategories, categoryInput: '' })
  },

  removeCategory(e) {
    const index = e.currentTarget.dataset.index
    const editingCategories = [...this.data.editingCategories]
    editingCategories.splice(index, 1)
    this.setData({ editingCategories })
  },

  async saveCategories() {
    if (this.data.editingCategories.length === 0) {
      wx.showToast({ title: '至少保留一个分类', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中' })
    try {
      const existing = await cloudApi.getCategories() || []
      const otherType = this.data.categoryEditType === 'expense' ? 'income' : 'expense'
      const otherCategories = existing
        .filter(c => c.type === otherType)
        .map((c, i) => ({ name: c.name, type: c.type, sort: i }))

      const newCategories = this.data.editingCategories.map((name, i) => ({
        name,
        type: this.data.categoryEditType,
        sort: i
      }))

      await cloudApi.saveCategories([...otherCategories, ...newCategories])

      wx.showToast({ title: '分类保存成功', icon: 'success' })

      if (this.data.categoryEditType === 'expense') {
        this.setData({ expenseCategories: [...this.data.editingCategories] })
      } else {
        this.setData({ incomeCategories: [...this.data.editingCategories] })
      }

      this.setData({ showCategoryEdit: false })
    } catch (err) {
      console.error('保存分类失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onShareAppMessage() {
    return {
      title: `小账本 · 已记录 ${this.data.totalCount} 笔账单，理财好帮手`,
      path: '/pages/mine/mine'
    }
  },

  onShareTimeline() {
    return {
      title: '小账本 · 个人记账理财助手',
      query: ''
    }
  },

  resetCategories() {
    const app = getApp()
    const type = this.data.categoryEditType
    const defaults = type === 'expense'
      ? app.globalData.defaultExpenseCategories
      : app.globalData.defaultIncomeCategories

    this.setData({ editingCategories: [...defaults] })
  }
})
