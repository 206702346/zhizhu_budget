const cloudApi = require('../../utils/cloud.js')
const { exportMonthReport, saveToAlbum } = require('../../utils/export.js')

Page({
  data: {
    bills: [],
    selectedMonth: '',
    income: '0.00',
    expense: '0.00',
    balance: '0.00',
    count: 0,
    // 搜索
    searchKeyword: '',
    searchMinAmount: '',
    searchMaxAmount: '',
    showSearch: false,
    isSearching: false,
    // 导出
    exporting: false,
    // 编辑弹窗
    showEditModal: false,
    editId: '',
    editType: 'expense',
    editAmount: '',
    editCategory: '餐饮',
    editDate: '',
    editNote: '',
    editCategoryIndex: 0,
    expenseCategories: [],
    incomeCategories: []
  },

  onLoad() {
    this.setData({ selectedMonth: this.getCurrentMonth() })
    this.loadCategories()
  },

  onShow() {
    this.loadBills()
  },

  getCurrentMonth() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  },

  goAdd() {
    wx.switchTab({ url: '/pages/add/add' })
  },

  async loadCategories() {
    const app = getApp()
    try {
      const categories = await cloudApi.getCategories()
      if (categories && categories.length > 0) {
        this.setData({
          incomeCategories: categories.filter(c => c.type === 'income').sort((a, b) => a.sort - b.sort).map(c => c.name),
          expenseCategories: categories.filter(c => c.type === 'expense').sort((a, b) => a.sort - b.sort).map(c => c.name)
        })
      }
    } catch (err) {
      this.setData({
        incomeCategories: app.globalData.defaultIncomeCategories,
        expenseCategories: app.globalData.defaultExpenseCategories
      })
    }
  },

  // ========== 搜索 ==========

  toggleSearch() {
    this.setData({ showSearch: !this.data.showSearch })
    if (!this.data.showSearch) {
      // 关闭搜索时恢复默认
      this.setData({ searchKeyword: '', searchMinAmount: '', searchMaxAmount: '', isSearching: false })
      this.loadBills()
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onMinAmountInput(e) {
    this.setData({ searchMinAmount: e.detail.value })
  },

  onMaxAmountInput(e) {
    this.setData({ searchMaxAmount: e.detail.value })
  },

  async doSearch() {
    const { searchKeyword, searchMinAmount, searchMaxAmount, selectedMonth } = this.data
    const keyword = searchKeyword.trim()

    if (!keyword && !searchMinAmount && !searchMaxAmount) {
      // 无搜索条件，恢复默认
      this.setData({ isSearching: false })
      this.loadBills()
      return
    }

    wx.showLoading({ title: '搜索中' })

    try {
      const result = await cloudApi.searchBills({
        keyword: keyword || undefined,
        minAmount: searchMinAmount || undefined,
        maxAmount: searchMaxAmount || undefined,
        month: selectedMonth || undefined
      })

      const bills = result.list || []
      let income = 0
      let expense = 0
      bills.forEach(item => {
        const amount = Number(item.amount) || 0
        if (item.type === 'income') income += amount
        else expense += amount
      })

      this.setData({
        bills,
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        balance: (income - expense).toFixed(2),
        count: bills.length,
        isSearching: true
      })
    } catch (err) {
      console.error('搜索失败:', err)
      wx.showToast({ title: '搜索失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  clearSearch() {
    this.setData({
      searchKeyword: '',
      searchMinAmount: '',
      searchMaxAmount: '',
      isSearching: false
    })
    this.loadBills()
  },

  // ========== 月份 ==========

  onMonthChange(e) {
    this.setData({ selectedMonth: e.detail.value })
    if (this.data.isSearching) {
      this.doSearch()
    } else {
      this.loadBills()
    }
  },

  async loadBills() {
    wx.showLoading({ title: '加载中' })

    try {
      const { selectedMonth } = this.data
      const result = await cloudApi.getBills({ month: selectedMonth, pageSize: 200 })

      const bills = result.list || []
      let income = 0
      let expense = 0
      bills.forEach(item => {
        const amount = Number(item.amount) || 0
        if (item.type === 'income') income += amount
        else expense += amount
      })

      this.setData({
        bills,
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        balance: (income - expense).toFixed(2),
        count: bills.length
      })
    } catch (err) {
      console.error('加载失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // ========== 导出 ==========

  async exportBills() {
    if (this.data.exporting) return

    wx.showLoading({ title: '生成图片中...' })
    this.setData({ exporting: true })

    try {
      // 获取当月全部账单
      const allResult = await cloudApi.getBills({ month: this.data.selectedMonth, pageSize: 500 })

      const exportData = {
        month: this.data.selectedMonth,
        income: this.data.income,
        expense: this.data.expense,
        balance: this.data.balance,
        count: this.data.count,
        categoryStats: this.getCategoryStatsFromBills(allResult.list || []),
        bills: allResult.list || []
      }

      const tempPath = await exportMonthReport(exportData)
      await saveToAlbum(tempPath)

      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (err) {
      console.error('导出失败:', err)
      wx.showToast({ title: '导出失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ exporting: false })
    }
  },

  onShareAppMessage() {
    return {
      title: `小账本 · ${this.data.selectedMonth} 账单，共支出 ¥${this.data.expense}`,
      path: '/pages/list/list'
    }
  },

  onShareTimeline() {
    return {
      title: `小账本 · ${this.data.selectedMonth} 账单明细`,
      query: ''
    }
  },

  getCategoryStatsFromBills(bills) {
    const categoryMap = {}
    bills.forEach((item) => {
      if (item.type === 'expense') {
        const cat = item.category || '其他'
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(item.amount || 0)
      }
    })
    return Object.keys(categoryMap)
      .map((key) => ({ name: key, amount: categoryMap[key].toFixed(2) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
  },

  // ========== 删除 ==========

  deleteBill(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定要删除这条账单吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await cloudApi.deleteBill(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadBills()
        } catch (err) {
          console.error('删除失败:', err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // ========== 编辑 ==========

  openEdit(e) {
    const item = e.currentTarget.dataset.item
    const app = getApp()
    const expenseCats = this.data.expenseCategories.length > 0
      ? this.data.expenseCategories : app.globalData.defaultExpenseCategories
    const incomeCats = this.data.incomeCategories.length > 0
      ? this.data.incomeCategories : app.globalData.defaultIncomeCategories
    const categories = item.type === 'income' ? incomeCats : expenseCats
    const catIndex = categories.indexOf(item.category)

    this.setData({
      showEditModal: true,
      editId: item._id,
      editType: item.type,
      editAmount: String(item.amount),
      editCategory: item.category,
      editDate: item.date,
      editNote: item.note || '',
      editCategoryIndex: catIndex >= 0 ? catIndex : 0,
      expenseCategories: expenseCats,
      incomeCategories: incomeCats
    })
  },

  closeEdit() {
    this.setData({ showEditModal: false })
  },

  onEditTypeChange(e) {
    const type = e.detail.value
    const categories = type === 'income' ? this.data.incomeCategories : this.data.expenseCategories
    this.setData({ editType: type, editCategory: categories[0] || '其他', editCategoryIndex: 0 })
  },

  onEditAmountInput(e) { this.setData({ editAmount: e.detail.value }) },

  onEditCategoryChange(e) {
    const index = Number(e.detail.value)
    const categories = this.data.editType === 'income' ? this.data.incomeCategories : this.data.expenseCategories
    this.setData({ editCategoryIndex: index, editCategory: categories[index] || '其他' })
  },

  onEditDateChange(e) { this.setData({ editDate: e.detail.value }) },

  onEditNoteInput(e) { this.setData({ editNote: e.detail.value }) },

  async saveEdit() {
    const { editId, editType, editAmount, editCategory, editDate, editNote } = this.data
    const num = Number(editAmount)

    if (!editAmount || Number.isNaN(num) || num <= 0) {
      wx.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中' })
    try {
      await cloudApi.updateBill({
        _id: editId, type: editType, amount: num,
        category: editCategory, date: editDate, note: editNote.trim()
      })
      wx.showToast({ title: '修改成功', icon: 'success' })
      this.closeEdit()
      this.loadBills()
    } catch (err) {
      console.error('修改失败:', err)
      wx.showToast({ title: '修改失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
