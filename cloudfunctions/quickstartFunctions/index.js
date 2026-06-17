const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// ========== 用户相关 ==========

// 获取 openid
const getOpenId = async () => {
  const wxContext = cloud.getWXContext()
  return {
    success: true,
    data: {
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID
    }
  }
}

// ========== 账单 CRUD ==========

// 新增账单
const addBill = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { type, amount, category, date, note } = event.data

    if (!type || !amount || !category || !date) {
      return { success: false, errMsg: '缺少必填字段' }
    }

    const result = await db.collection('bills').add({
      data: {
        _openid: openid,
        type,
        amount: Number(amount),
        category,
        date,
        note: (note || '').trim(),
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    return { success: true, data: { _id: result._id } }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// 查询账单（支持按月、按类型筛选，分页）
const getBills = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { month, type, pageSize = 100, page = 1 } = event.data || {}

    // 基础条件：只查当前用户的账单
    const conditions = { _openid: openid }

    // 按月筛选：匹配 date 字段前缀 YYYY-MM
    if (month && typeof month === 'string') {
      conditions.date = db.RegExp({
        regexp: `^${month}`,
        options: ''
      })
    }

    // 按类型筛选
    if (type && (type === 'income' || type === 'expense')) {
      conditions.type = type
    }

    const skip = (page - 1) * pageSize

    const result = await db.collection('bills')
      .where(conditions)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    // 获取总数
    const countResult = await db.collection('bills')
      .where(conditions)
      .count()

    return {
      success: true,
      data: {
        list: result.data,
        total: countResult.total,
        page,
        pageSize
      }
    }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// 更新账单
const updateBill = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { _id, type, amount, category, date, note } = event.data

    if (!_id) {
      return { success: false, errMsg: '缺少 _id' }
    }

    // 只能更新自己的账单
    const updateData = { updateTime: db.serverDate() }
    if (type !== undefined) updateData.type = type
    if (amount !== undefined) updateData.amount = Number(amount)
    if (category !== undefined) updateData.category = category
    if (date !== undefined) updateData.date = date
    if (note !== undefined) updateData.note = note.trim()

    const result = await db.collection('bills')
      .where({ _id, _openid: openid })
      .update({ data: updateData })

    if (result.stats.updated === 0) {
      return { success: false, errMsg: '账单不存在或无权限修改' }
    }

    return { success: true, data: result.stats }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// 删除账单
const deleteBill = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { _id } = event.data

    if (!_id) {
      return { success: false, errMsg: '缺少 _id' }
    }

    // 只能删除自己的账单
    const result = await db.collection('bills')
      .where({ _id, _openid: openid })
      .remove()

    if (result.stats.removed === 0) {
      return { success: false, errMsg: '账单不存在或无权限删除' }
    }

    return { success: true, data: result.stats }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// ========== 统计相关 ==========

// 获取月度统计
const getMonthStats = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { month } = event.data || {}

    if (!month) {
      return { success: false, errMsg: '缺少 month 参数' }
    }

    const monthBills = await db.collection('bills')
      .where({
        _openid: openid,
        date: db.RegExp({ regexp: `^${month}`, options: '' })
      })
      .get()

    let income = 0
    let expense = 0
    const categoryMap = {}

    monthBills.data.forEach((item) => {
      const amount = Number(item.amount) || 0
      if (item.type === 'income') {
        income += amount
      } else {
        expense += amount
        const category = item.category || '其他'
        categoryMap[category] = (categoryMap[category] || 0) + amount
      }
    })

    const categoryStats = Object.keys(categoryMap)
      .map((key) => ({ name: key, amount: categoryMap[key].toFixed(2) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))

    return {
      success: true,
      data: {
        income: income.toFixed(2),
        expense: expense.toFixed(2),
        balance: (income - expense).toFixed(2),
        count: monthBills.data.length,
        categoryStats
      }
    }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// 获取总览统计
const getOverviewStats = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const allBills = await db.collection('bills')
      .where({ _openid: openid })
      .get()

    const totalCount = allBills.data.length

    // 本月数据
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    let monthIncome = 0
    let monthExpense = 0
    let monthCount = 0

    allBills.data.forEach((item) => {
      if (typeof item.date === 'string' && item.date.startsWith(monthStr)) {
        monthCount++
        const amount = Number(item.amount) || 0
        if (item.type === 'income') {
          monthIncome += amount
        } else {
          monthExpense += amount
        }
      }
    })

    return {
      success: true,
      data: {
        totalCount,
        monthCount,
        monthIncome: monthIncome.toFixed(2),
        monthExpense: monthExpense.toFixed(2),
        monthBalance: (monthIncome - monthExpense).toFixed(2)
      }
    }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// ========== 搜索账单 ==========

const searchBills = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { keyword, minAmount, maxAmount, month, type } = event.data || {}

    const conditions = { _openid: openid }

    if (month) {
      conditions.date = db.RegExp({ regexp: `^${month}`, options: '' })
    }
    if (type && (type === 'income' || type === 'expense')) {
      conditions.type = type
    }

    // 关键词搜索（备注或分类）
    if (keyword) {
      conditions.$or = [
        { note: db.RegExp({ regexp: keyword, options: 'i' }) },
        { category: db.RegExp({ regexp: keyword, options: 'i' }) }
      ]
    }

    const result = await db.collection('bills')
      .where(conditions)
      .orderBy('createTime', 'desc')
      .get()

    // 金额范围筛选（云数据库不支持 where 后用比较，需要在结果中过滤）
    let list = result.data
    if (minAmount !== undefined) {
      list = list.filter((item) => Number(item.amount) >= Number(minAmount))
    }
    if (maxAmount !== undefined) {
      list = list.filter((item) => Number(item.amount) <= Number(maxAmount))
    }

    return { success: true, data: { list, total: list.length } }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// ========== 分类管理 ==========

// 获取自定义分类
const getCategories = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const result = await db.collection('categories')
      .where({ _openid: openid })
      .get()

    return { success: true, data: result.data }
  } catch (e) {
    // 集合可能不存在，返回空数组
    return { success: true, data: [] }
  }
}

// 保存分类
const saveCategories = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { categories } = event.data
    if (!categories || !Array.isArray(categories)) {
      return { success: false, errMsg: 'categories 必须是数组' }
    }

    // 先删除旧分类，再批量写入
    await db.collection('categories')
      .where({ _openid: openid })
      .remove()

    if (categories.length > 0) {
      const tasks = categories.map((cat) =>
        db.collection('categories').add({
          data: {
            _openid: openid,
            name: cat.name,
            type: cat.type, // 'income' | 'expense'
            sort: cat.sort || 0
          }
        })
      )
      await Promise.all(tasks)
    }

    return { success: true }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// ========== 预算管理 ==========

// 获取预算
const getBudget = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { month } = event.data || {}

    const result = await db.collection('budgets')
      .where({ _openid: openid, month })
      .get()

    if (result.data.length > 0) {
      return { success: true, data: result.data[0] }
    }

    return { success: true, data: null }
  } catch (e) {
    return { success: true, data: null }
  }
}

// 设置预算
const setBudget = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { month, amount } = event.data

    if (!month || amount === undefined) {
      return { success: false, errMsg: '缺少 month 或 amount' }
    }

    // 查找是否已有该月预算
    const existResult = await db.collection('budgets')
      .where({ _openid: openid, month })
      .get()

    if (existResult.data.length > 0) {
      // 更新
      await db.collection('budgets')
        .doc(existResult.data[0]._id)
        .update({ data: { amount: Number(amount), updateTime: db.serverDate() } })
    } else {
      // 新增
      await db.collection('budgets').add({
        data: {
          _openid: openid,
          month,
          amount: Number(amount),
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    }

    return { success: true }
  } catch (e) {
    return { success: false, errMsg: e.message }
  }
}

// ========== 入口 ==========

exports.main = async (event, context) => {
  switch (event.type) {
    // 用户
    case 'getOpenId':
      return await getOpenId()

    // 账单 CRUD
    case 'addBill':
      return await addBill(event)
    case 'getBills':
      return await getBills(event)
    case 'updateBill':
      return await updateBill(event)
    case 'deleteBill':
      return await deleteBill(event)

    // 统计
    case 'getMonthStats':
      return await getMonthStats(event)
    case 'getOverviewStats':
      return await getOverviewStats()

    // 搜索
    case 'searchBills':
      return await searchBills(event)

    // 分类管理
    case 'getCategories':
      return await getCategories()
    case 'saveCategories':
      return await saveCategories(event)

    // 预算管理
    case 'getBudget':
      return await getBudget(event)
    case 'setBudget':
      return await setBudget(event)

    // 兼容旧接口
    case 'getMiniProgramCode':
      return await getMiniProgramCode()
    case 'createCollection':
      return await createCollection()
    case 'selectRecord':
      return await selectRecord()
    case 'updateRecord':
      return await updateRecord(event)
    case 'insertRecord':
      return await insertRecord(event)
    case 'deleteRecord':
      return await deleteRecord(event)

    default:
      return { success: false, errMsg: `未知操作类型: ${event.type}` }
  }
}

// ========== 以下为旧接口兼容（sales 表）==========

const getMiniProgramCode = async () => {
  const resp = await cloud.openapi.wxacode.get({ path: 'pages/index/index' })
  const { buffer } = resp
  const upload = await cloud.uploadFile({
    cloudPath: 'code.png',
    fileContent: buffer
  })
  return upload.fileID
}

const createCollection = async () => {
  try {
    await db.createCollection('sales')
    await db.collection('sales').add({ data: { region: '华东', city: '上海', sales: 11 } })
    await db.collection('sales').add({ data: { region: '华东', city: '南京', sales: 11 } })
    await db.collection('sales').add({ data: { region: '华南', city: '广州', sales: 22 } })
    await db.collection('sales').add({ data: { region: '华南', city: '深圳', sales: 22 } })
    return { success: true }
  } catch (e) {
    return { success: true, data: 'create collection success' }
  }
}

const selectRecord = async () => {
  return await db.collection('sales').get()
}

const updateRecord = async (event) => {
  try {
    for (let i = 0; i < event.data.length; i++) {
      await db.collection('sales').where({ _id: event.data[i]._id }).update({
        data: { sales: event.data[i].sales }
      })
    }
    return { success: true, data: event.data }
  } catch (e) {
    return { success: false, errMsg: e }
  }
}

const insertRecord = async (event) => {
  try {
    const { region, city, sales } = event.data
    await db.collection('sales').add({ data: { region, city, sales: Number(sales) } })
    return { success: true, data: event.data }
  } catch (e) {
    return { success: false, errMsg: e }
  }
}

const deleteRecord = async (event) => {
  try {
    await db.collection('sales').where({ _id: event.data._id }).remove()
    return { success: true }
  } catch (e) {
    return { success: false, errMsg: e }
  }
}
