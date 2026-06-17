/**
 * Canvas 2D 图表绘制工具
 * 配色方案与现代 UI 统一
 */

const PIE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f43f5e', '#64748b', '#78716c'
]

/**
 * 绘制饼图（带圆环效果）
 */
function drawPieChart(ctx, data, width, height) {
  if (!data || data.length === 0) return

  const dpr = wx.getSystemInfoSync().pixelRatio
  ctx.scale(dpr, dpr)

  const canvasW = width / dpr
  const canvasH = height / dpr

  ctx.clearRect(0, 0, canvasW, canvasH)

  const total = data.reduce((sum, item) => sum + Number(item.amount), 0)
  if (total === 0) {
    drawEmpty(ctx, canvasW, canvasH, '暂无数据')
    return
  }

  const centerX = canvasW * 0.35
  const centerY = canvasH / 2
  const outerRadius = Math.min(centerX, centerY) - 12
  const innerRadius = outerRadius * 0.58

  // 绘制扇形
  let startAngle = -Math.PI / 2

  data.forEach((item, index) => {
    const value = Number(item.amount)
    const angle = (value / total) * Math.PI * 2

    // 外圈扇形
    ctx.beginPath()
    ctx.moveTo(centerX + innerRadius * Math.cos(startAngle), centerY + innerRadius * Math.sin(startAngle))
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + angle)
    ctx.arc(centerX, centerY, innerRadius, startAngle + angle, startAngle, true)
    ctx.closePath()
    ctx.fillStyle = PIE_COLORS[index % PIE_COLORS.length]
    ctx.fill()

    // 百分比文字（只在外圈空间足够时显示）
    const percent = ((value / total) * 100).toFixed(1)
    if (Number(percent) >= 4) {
      const midAngle = startAngle + angle / 2
      const textR = (innerRadius + outerRadius) / 2
      const textX = centerX + Math.cos(midAngle) * textR
      const textY = centerY + Math.sin(midAngle) * textR

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(percent + '%', textX, textY)
    }

    startAngle += angle
  })

  // 中心文字
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 18px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(data.length + '类', centerX, centerY)

  // 图例
  const legendX = canvasW * 0.68
  let legendY = 20
  const maxLegendH = canvasH - 16

  data.forEach((item, index) => {
    if (legendY > maxLegendH) return

    // 色块（圆角矩形模拟）
    ctx.fillStyle = PIE_COLORS[index % PIE_COLORS.length]
    ctx.beginPath()
    roundRect(ctx, legendX, legendY, 20, 10, 3)
    ctx.fill()

    // 文字
    ctx.fillStyle = '#64748b'
    ctx.font = '11px -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const label = item.name.length > 3 ? item.name.slice(0, 3) + '…' : item.name
    const percent = ((Number(item.amount) / total) * 100).toFixed(1)
    ctx.fillText(label + ' ' + percent + '%', legendX + 26, legendY - 1)

    legendY += 24
  })
}

/**
 * 绘制柱状图（月度收支对比，带圆角柱子）
 */
function drawBarChart(ctx, data, width, height) {
  if (!data || data.length === 0) return

  const dpr = wx.getSystemInfoSync().pixelRatio
  ctx.scale(dpr, dpr)

  const canvasW = width / dpr
  const canvasH = height / dpr

  ctx.clearRect(0, 0, canvasW, canvasH)

  const maxVal = Math.max(
    ...data.map(d => Math.max(Number(d.income) || 0, Number(d.expense) || 0)),
    1
  )

  const padding = { top: 24, right: 16, bottom: 36, left: 48 }
  const chartW = canvasW - padding.left - padding.right
  const chartH = canvasH - padding.top - padding.bottom

  // Y 轴网格线
  const ySteps = 4
  for (let i = 0; i <= ySteps; i++) {
    const y = padding.top + (chartH / ySteps) * i

    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(canvasW - padding.right, y)
    ctx.stroke()

    const val = maxVal - (maxVal / ySteps) * i
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatAmount(val), padding.left - 8, y)
  }

  // X 轴
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top + chartH)
  ctx.lineTo(canvasW - padding.right, padding.top + chartH)
  ctx.stroke()

  // 柱子
  const barGroupW = chartW / data.length
  const barW = Math.min(barGroupW * 0.26, 24)

  data.forEach((item, index) => {
    const groupX = padding.left + barGroupW * index
    const incomeH = Math.max(((Number(item.income) || 0) / maxVal) * chartH, 0)
    const expenseH = Math.max(((Number(item.expense) || 0) / maxVal) * chartH, 0)

    // 收入柱
    const incomeX = groupX + barGroupW * 0.18
    if (incomeH > 0) {
      ctx.fillStyle = '#10b981'
      roundRect(ctx, incomeX, padding.top + chartH - incomeH, barW, incomeH, { upperLeft: 4, upperRight: 4 })
      ctx.fill()
    }

    // 支出柱
    const expenseX = incomeX + barW + 4
    if (expenseH > 0) {
      ctx.fillStyle = '#ef4444'
      roundRect(ctx, expenseX, padding.top + chartH - expenseH, barW, expenseH, { upperLeft: 4, upperRight: 4 })
      ctx.fill()
    }

    // 月份标签
    ctx.fillStyle = '#94a3b8'
    ctx.font = '10px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(item.month + '月', groupX + barGroupW / 2, padding.top + chartH + 10)
  })

  // 图例
  const legendY = 6
  // 收入
  ctx.fillStyle = '#10b981'
  ctx.beginPath()
  roundRect(ctx, canvasW - 110, legendY, 12, 12, 3)
  ctx.fill()
  ctx.fillStyle = '#64748b'
  ctx.font = '10px -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('收入', canvasW - 94, legendY)

  // 支出
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  roundRect(ctx, canvasW - 58, legendY, 12, 12, 3)
  ctx.fill()
  ctx.fillStyle = '#64748b'
  ctx.fillText('支出', canvasW - 42, legendY)
}

function drawEmpty(ctx, w, h, text) {
  ctx.fillStyle = '#94a3b8'
  ctx.font = '14px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2)
}

function formatAmount(val) {
  if (val >= 10000) return (val / 10000).toFixed(1) + 'w'
  if (val >= 1000) return (val / 1000).toFixed(1) + 'k'
  return String(Math.round(val))
}

/**
 * 绘制圆角矩形路径
 */
function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r }
  if (!r) r = { tl: 0, tr: 0, br: 0, bl: 0 }
  r.tl = r.tl || r.upperLeft || 0
  r.tr = r.tr || r.upperRight || 0
  r.br = r.br || r.lowerRight || 0
  r.bl = r.bl || r.lowerLeft || 0

  ctx.beginPath()
  ctx.moveTo(x + r.tl, y)
  ctx.lineTo(x + w - r.tr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr)
  ctx.lineTo(x + w, y + h - r.br)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h)
  ctx.lineTo(x + r.bl, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl)
  ctx.lineTo(x, y + r.tl)
  ctx.quadraticCurveTo(x, y, x + r.tl, y)
  ctx.closePath()
}

module.exports = {
  drawPieChart,
  drawBarChart,
  PIE_COLORS
}
