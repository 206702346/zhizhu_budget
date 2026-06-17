/**
 * 云函数调用工具模块
 * 统一封装 wx.cloud.callFunction，返回 Promise 风格
 */

const callFunction = (type, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type, data }
    }).then((res) => {
      const result = res.result
      if (result && result.success) {
        resolve(result.data)
      } else {
        reject(result || { errMsg: '未知错误' })
      }
    }).catch((err) => {
      reject(err)
    })
  })
}

// ========== 用户 ==========

const getOpenId = () => callFunction('getOpenId')

// ========== 账单 CRUD ==========

const addBill = (data) => callFunction('addBill', data)

const getBills = (params = {}) => callFunction('getBills', params)

const updateBill = (data) => callFunction('updateBill', data)

const deleteBill = (_id) => callFunction('deleteBill', { _id })

// ========== 统计 ==========

const getMonthStats = (month) => callFunction('getMonthStats', { month })

const getOverviewStats = () => callFunction('getOverviewStats')

// ========== 搜索 ==========

const searchBills = (params = {}) => callFunction('searchBills', params)

// ========== 分类管理 ==========

const getCategories = () => callFunction('getCategories')

const saveCategories = (categories) => callFunction('saveCategories', { categories })

// ========== 预算管理 ==========

const getBudget = (month) => callFunction('getBudget', { month })

const setBudget = (month, amount) => callFunction('setBudget', { month, amount })

module.exports = {
  getOpenId,
  addBill,
  getBills,
  updateBill,
  deleteBill,
  getMonthStats,
  getOverviewStats,
  searchBills,
  getCategories,
  saveCategories,
  getBudget,
  setBudget
}
