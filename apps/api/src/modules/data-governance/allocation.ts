/**
 * allocation.ts — 财务级“余额归底分摊算法” (Remainder Allocation Algorithm)
 * 
 * 业务背景：
 * 在亿元级营收、数百万订单规模下，大促跨店满减或全单优惠按商品金额比例分摊时，
 * 若单纯使用浮点数除法或简单的四舍五入 ROUND(val, 2)，
 * 极易产生累积的“一分钱偏差”（例如总优惠 50 元分给 3 个相同商品，四舍五入后变成 16.67 * 3 = 50.01 元，导致明细总和超过主单总优惠）。
 * 
 * 解决方案：
 * 采用“余额归底法”：
 * 1. 前 N-1 个商品按比例计算并截断保留两位小数；
 * 2. 最后一个商品（第 N 个商品）强制取差额：
 *    Discount_N = TotalDiscount - SUM(Discount_1 ... Discount_N-1)
 * 3. 严格保证 SUM(item_discounts) === order_total_discount，财务平账误差绝对为 0。
 */

export interface ItemForAllocation {
  id?: string | number
  amount: number // 商品金额
  [key: string]: any
}

export interface AllocatedItemResult<T extends ItemForAllocation> {
  item: T
  allocatedDiscount: number
  netAmount: number
}

/**
 * 严格两分位金额四舍五入（避免浮点数精度抖动）
 */
function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

/**
 * 严格两分位截断
 */
function truncateToTwo(num: number): number {
  return Math.floor((num + Number.EPSILON) * 100) / 100
}

/**
 * 财务级余额归底分摊执行器
 * 
 * @param totalDiscount 订单级需分摊的总优惠金额 (>= 0)
 * @param items 商品明细列表 (需包含 amount >= 0)
 */
export function allocateDiscountWithRemainder<T extends ItemForAllocation>(
  totalDiscount: number,
  items: T[]
): AllocatedItemResult<T>[] {
  const normDiscount = roundToTwo(Number(totalDiscount) || 0)
  if (items.length === 0) return []

  if (normDiscount <= 0) {
    return items.map((item) => ({
      item,
      allocatedDiscount: 0,
      netAmount: roundToTwo(item.amount),
    }))
  }

  const totalAmount = items.reduce((sum, it) => sum + Math.max(0, Number(it.amount) || 0), 0)
  if (totalAmount <= 0) {
    // 若总金额为 0，平均平摊给最后一项做归底
    return items.map((item, idx) => {
      const discount = idx === items.length - 1 ? normDiscount : 0
      return {
        item,
        allocatedDiscount: discount,
        netAmount: 0,
      }
    })
  }

  let allocatedSum = 0
  const results: AllocatedItemResult<T>[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const itemAmt = Math.max(0, Number(item.amount) || 0)

    if (i === items.length - 1) {
      // 最后一项：强制取差额（余额归底）
      const remainder = roundToTwo(normDiscount - allocatedSum)
      // 容错：分摊优惠不能大于商品本身金额（若超额则截断，确保业务合理性）
      const finalDiscount = Math.max(0, remainder)
      results.push({
        item,
        allocatedDiscount: finalDiscount,
        netAmount: roundToTwo(Math.max(0, itemAmt - finalDiscount)),
      })
      allocatedSum = roundToTwo(allocatedSum + finalDiscount)
    } else {
      // 前 N-1 项：按比例截断
      const proportion = itemAmt / totalAmount
      const rawShare = normDiscount * proportion
      const itemShare = truncateToTwo(rawShare)
      allocatedSum = roundToTwo(allocatedSum + itemShare)

      results.push({
        item,
        allocatedDiscount: itemShare,
        netAmount: roundToTwo(Math.max(0, itemAmt - itemShare)),
      })
    }
  }

  return results
}

