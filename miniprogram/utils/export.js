/**
 * 账单数据导出为图片
 * 使用离屏 Canvas 渲染精美的统计卡片，保存到相册
 */

/**
 * 导出月度账单统计图
 * @param {Object} data - { month, income, expense, balance, count, categoryStats, bills }
 * @returns {Promise<string>} 临时图片路径
 */
function exportMonthReport(data) {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery()
    query.select('#exportCanvas')
      .fields({ node: true, size: false })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error('Canvas 节点未找到，请确保页面中存在 <canvas type="2d" id="exportCanvas">'))
          return
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = 2

        const width = 750
        const height = calcHeight(data)

        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        // 白色背景
        ctx.fillStyle = '#f2f4f8'
        ctx.fillRect(0, 0, width, height)

        drawHeader(ctx, data, width)
        const yAfterSummary = drawSummary(ctx, data, width)
        const yAfterCats = drawCategoryList(ctx, data, width, yAfterSummary)
        drawBillList(ctx, data, width, yAfterCats)
        drawFooter(ctx, width, height)

        // 导出为图片
        wx.canvasToTempFilePath({
          canvas,
          fileType: 'png',
          quality: 1,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err)
        })
      })
  })
}

function calcHeight(data) {
  const billCount = (data.bills || []).length
  const catCount = (data.categoryStats || []).length
  let h = 60 + 280 + 20 // header + summary
  if (catCount > 0) h += 60 + catCount * 42 + 20
  h += 50 + Math.min(billCount, 8) * 48 + 20
  h += 60 // footer
  return h
}

function drawHeader(ctx, data, w) {
  // 顶部深色条
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  grad.addColorStop(0, '#1e293b')
  grad.addColorStop(1, '#334155')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(w, 0)
  ctx.lineTo(w, 240)
  ctx.quadraticCurveTo(w / 2, 320, 0, 240)
  ctx.closePath()
  ctx.fill()

  // 标题
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 36px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('小账本 · 月度账单', w / 2, 30)

  // 月份
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '22px -apple-system, sans-serif'
  ctx.fillText(data.month || '', w / 2, 78)

  // 大数字结余
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 56px -apple-system, sans-serif'
  ctx.fillText('¥' + (data.balance || '0.00'), w / 2, 118)

  // 收入 / 支出
  const labelY = 190
  ctx.font = '20px -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.textAlign = 'center'

  // 收入
  ctx.fillText('收入', w * 0.3, labelY)
  ctx.font = 'bold 26px -apple-system, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText('¥' + (data.income || '0.00'), w * 0.3, labelY + 28)

  // 竖线
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w / 2, labelY - 4)
  ctx.lineTo(w / 2, labelY + 50)
  ctx.stroke()

  // 支出
  ctx.font = '20px -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('支出', w * 0.7, labelY)
  ctx.font = 'bold 26px -apple-system, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText('¥' + (data.expense || '0.00'), w * 0.7, labelY + 28)
}

function drawSummary(ctx, data, w) {
  const y = 290
  const cardX = 30
  const cardW = w - 60

  // 白色卡片
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  roundRectPath(ctx, cardX, y, cardW, 130, 16)
  ctx.fill()
  // 阴影
  ctx.shadowColor = 'rgba(0,0,0,0.06)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  const items = [
    { label: '记录笔数', value: (data.count || 0) + ' 笔' },
    { label: '本月收入', value: '¥' + (data.income || '0.00'), color: '#10b981' },
    { label: '本月支出', value: '¥' + (data.expense || '0.00'), color: '#ef4444' }
  ]

  const itemW = cardW / 3
  items.forEach((item, i) => {
    const cx = cardX + itemW * i + itemW / 2
    ctx.fillStyle = item.color || '#1e293b'
    ctx.font = 'bold 28px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.value, cx, y + 52)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px -apple-system, sans-serif'
    ctx.fillText(item.label, cx, y + 88)

    if (i < 2) {
      ctx.strokeStyle = '#f1f5f9'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cardX + itemW * (i + 1), y + 30)
      ctx.lineTo(cardX + itemW * (i + 1), y + 100)
      ctx.stroke()
    }
  })

  return y + 130 + 24
}

function drawCategoryList(ctx, data, w, startY) {
  const cats = data.categoryStats || []
  if (cats.length === 0) return startY

  const cardX = 30
  const cardW = w - 60
  const titleY = startY
  const listY = titleY + 48

  // 标题
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 26px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('支出分类排行', cardX + 10, titleY)

  const cardH = cats.length * 42 + 20
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  roundRectPath(ctx, cardX, listY, cardW, cardH, 16)
  ctx.fill()

  const colors = ['#ef4444','#f97316','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
  cats.forEach((cat, i) => {
    const cy = listY + 16 + i * 42

    // 色块
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath()
    roundRectPath(ctx, cardX + 18, cy + 4, 14, 14, 4)
    ctx.fill()

    // 名称
    ctx.fillStyle = '#1e293b'
    ctx.font = '24px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(cat.name, cardX + 44, cy + 11)

    // 金额
    ctx.fillStyle = '#ef4444'
    ctx.font = 'bold 24px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('¥' + cat.amount, cardX + cardW - 18, cy + 11)
  })

  return listY + cardH + 24
}

function drawBillList(ctx, data, w, startY) {
  const bills = (data.bills || []).slice(0, 8)
  if (bills.length === 0) return startY

  const cardX = 30
  const cardW = w - 60
  const titleY = startY

  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 26px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('账单明细', cardX + 10, titleY)

  const listY = titleY + 48
  const cardH = bills.length * 48 + 20
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  roundRectPath(ctx, cardX, listY, cardW, cardH, 16)
  ctx.fill()

  bills.forEach((bill, i) => {
    const by = listY + 18 + i * 48

    // 左边框
    ctx.fillStyle = bill.type === 'income' ? '#10b981' : '#ef4444'
    ctx.fillRect(cardX + 16, by - 4, 4, 28)

    // 分类
    ctx.fillStyle = '#1e293b'
    ctx.font = '24px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(bill.category, cardX + 32, by + 5)

    // 日期
    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px -apple-system, sans-serif'
    ctx.fillText(bill.date || '', cardX + 200, by + 5)

    // 金额
    const prefix = bill.type === 'income' ? '+' : '-'
    ctx.fillStyle = bill.type === 'income' ? '#10b981' : '#ef4444'
    ctx.font = 'bold 24px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(prefix + '¥' + bill.amount, cardX + cardW - 18, by + 5)
  })

  return listY + cardH + 24
}

function drawFooter(ctx, w, h) {
  ctx.fillStyle = '#94a3b8'
  ctx.font = '18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText('来自 小账本 小程序', w / 2, h - 24)
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * 保存图片到相册
 */
function saveToAlbum(tempFilePath) {
  return new Promise((resolve, reject) => {
    // 先检查权限
    wx.getSetting({
      success: (setting) => {
        if (setting.authSetting['scope.writePhotosAlbum'] === false) {
          wx.showModal({
            title: '提示',
            content: '需要授权保存到相册',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
          reject(new Error('未授权'))
          return
        }

        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => resolve(),
          fail: (err) => {
            if (err.errMsg.includes('auth deny')) {
              wx.showModal({
                title: '提示',
                content: '需要授权保存到相册',
                success: (modalRes) => {
                  if (modalRes.confirm) wx.openSetting()
                }
              })
            }
            reject(err)
          }
        })
      }
    })
  })
}

module.exports = {
  exportMonthReport,
  saveToAlbum
}
