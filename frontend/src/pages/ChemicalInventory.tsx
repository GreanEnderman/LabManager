import { useState } from 'react'
import { chemicals } from '../data'
import { getChemicalThreshold } from '../data/runtime-config'
import { getChemicalInventoryStatus } from '../data/selectors'

export default function ChemicalInventory() {
  const [keyword, setKeyword] = useState('')
  const [physicalForm, setPhysicalForm] = useState('全部分类')
  const [status, setStatus] = useState('全部状态')

  const filteredChemicals = chemicals.filter((item) => {
    const searchText = keyword.trim()
    const matchesKeyword =
      searchText === '' || item.name.includes(searchText) || (item.cas ?? '').includes(searchText)
    const matchesForm = physicalForm === '全部分类' || item.physicalForm === physicalForm
    const inventoryStatus = getChemicalInventoryStatus(item.totalQuantity, item.name)
    const matchesStatus = status === '全部状态' || inventoryStatus === status

    return matchesKeyword && matchesForm && matchesStatus
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-on-surface">化学品管理</h1>
        <div className="flex gap-3">
          <button className="rounded-lg bg-surface-container-high px-4 py-2 text-on-surface transition-colors hover:bg-surface-container-highest">
            导入
          </button>
          <button className="rounded-lg bg-surface-container-high px-4 py-2 text-on-surface transition-colors hover:bg-surface-container-highest">
            导出
          </button>
          <button className="rounded-lg bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-container">
            新增化学品
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-outline-variant bg-surface p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="搜索化学品名称或 CAS..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={physicalForm}
            onChange={(event) => setPhysicalForm(event.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          >
            <option>全部分类</option>
            <option>固体</option>
            <option>液体</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2"
          >
            <option>全部状态</option>
            <option>库存充足</option>
            <option>低库存</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface">
        <table className="w-full">
          <thead className="bg-surface-container-high">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">图片</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">名称</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">类别</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">规格</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">当前库存</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">预警阈值</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">状态</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-on-surface">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {filteredChemicals.map((item) => {
              const inventoryStatus = getChemicalInventoryStatus(item.totalQuantity, item.name)
              const low = inventoryStatus === '低库存'
              const threshold = getChemicalThreshold(item.name)

              return (
                <tr key={item.id} className="transition-colors hover:bg-surface-container-low">
                  <td className="px-6 py-4">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-surface-container">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-on-surface-variant">science</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface">{item.name}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{item.physicalForm ?? '-'}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{item.spec ?? '-'}</td>
                  <td className="px-6 py-4 font-medium text-on-surface">{item.totalQuantity} 瓶</td>
                  <td className="px-6 py-4 text-on-surface-variant">{threshold} 瓶</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm ${
                        low
                          ? 'bg-error-container text-error'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      {inventoryStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-primary hover:text-primary-container">
                      {item.images.length > 0 ? `图片 ${item.images.length} 张` : item.cas ? `CAS ${item.cas}` : '查看详情'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
