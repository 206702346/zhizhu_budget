const cloudApi = require('../../utils/cloud.js')
const app = getApp()

Page({
  data: {
    type: 'expense',
    amount: '',
    category: '餐饮',
    date: '',
    note: '',
    expenseCategories: app.globalData.defaultExpenseCategories,
    incomeCategories: app.globalData.defaultIncomeCategories,
    categoryIndex: 0,
    saving: false
  },

  onLoad() {
    this.setData({ date: this.getToday() })
    this.loadCategories()
  },

  onShow() {
    // 每次显示时重新加载分类（用户可能在"我的"页面修改了分类）
    this.loadCategories()
  },

  getToday() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  },

  async loadCategories() {
    try {
      const categories = await cloudApi.getCategories()
      if (categories && categories.length > 0) {
        const incomeCats = categories
          .filter((c) => c.type === 'income')
          .sort((a, b) => a.sort - b.sort)
          .map((c) => c.name)
        const expenseCats = categories
          .filter((c) => c.type === 'expense')
          .sort((a, b) => a.sort - b.sort)
          .map((c) => c.name)

        this.setData({
          incomeCategories: incomeCats.length > 0 ? incomeCats : app.globalData.defaultIncomeCategories,
          expenseCategories: expenseCats.length > 0 ? expenseCats : app.globalData.defaultExpenseCategories,
          category: this.data.type === 'income'
            ? (incomeCats.length > 0 ? incomeCats[0] : app.globalData.defaultIncomeCategories[0])
            : (expenseCats.length > 0 ? expenseCats[0] : app.globalData.defaultExpenseCategories[0]),
          categoryIndex: 0
        })
      }
    } catch (err) {
      // 分类加载失败，使用默认分类，不影响正常使用
      console.log('分类加载失败，使用默认分类')
    }
  },

  onTypeChange(e) {
    const type = e.detail.value
    const categories = type === 'income'
      ? this.data.incomeCategories
      : this.data.expenseCategories

    this.setData({
      type,
      categoryIndex: 0,
      category: categories[0] || '其他'
    })
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value)
    const categories = this.data.type === 'income'
      ? this.data.incomeCategories
      : this.data.expenseCategories

    this.setData({
      categoryIndex: index,
      category: categories[index] || '其他'
    })
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  onShareAppMessage() {
    return {
      title: '我在用小账本记账，快来一起记录生活！',
      path: '/pages/add/add'
    }
  },

  async saveBill() {
    if (this.data.saving) return

    const { type, amount, category, date, note } = this.data
    const num = Number(amount)

    if (!amount || Number.isNaN(num) || num <= 0) {
      wx.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中' })

    try {
      await cloudApi.addBill({ type, amount: num, category, date, note: note.trim() })

      wx.showToast({ title: '保存成功', icon: 'success' })

      this.setData({
        type: 'expense',
        amount: '',
        category: this.data.expenseCategories[0] || '餐饮',
        categoryIndex: 0,
        note: '',
        date: this.getToday(),
        saving: false
      })

      setTimeout(() => {
        wx.switchTab({ url: '/pages/list/list' })
      }, 600)
    } catch (err) {
      console.error('保存失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  }
})
