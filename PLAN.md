# PLAN — 标注标题「设置时」边缘自适应

- 设计文档：`docs/superpowers/specs/2026-10-09-title-set-time-edge-layout-design.md`
- 约束：禁止任何 git 操作；TDD；测试范围与改动一致；证据先于断言。

## 目标行为
设置标题时按**图片初始显示尺寸**判断一次并写回 `titlePosition`；渲染改为固定位置；缩放/拖动不重算；尊重显式设置。

## 进度

### Task 1: title-layout 纯函数扩展  ✅
- [x] 1.1 测试：`computeTitleLayout` 翻转与 offsetX 贴边、`getTitleAnchor`
- [x] 1.2 运行确认失败（TS2724/TS2305 未导出）
- [x] 1.3 实现：`computeTitleLayout`、`computeTitleBox`（bounds 可选）、`getTitleAnchor`
- [x] 1.4 运行确认通过（22/22）
- [x] 1.5 `npx tsc --noEmit` 通过

### Task 2: renderer 改为固定位置  ✅
- [x] 2.1 测试：固定绘制（画布 + 导出）
- [x] 2.2 运行确认失败（导出一例 59≠-17）
- [x] 2.3 修改 `renderer.ts`（去掉 bounds）；两个渲染策略 `getTitleAnchor` 委托共享函数
- [x] 2.4 renderers 套件通过（51/51）

### Task 3: store/API/UI 自动判断  ✅
- [x] 3.1 测试：靠上写回 bottom、靠左修正 offsetX、显式不覆盖、图片未加载跳过、UI 触发
- [x] 3.2 运行确认失败（4 例）
- [x] 3.3 修改 `types.ts`、`annotation-store.ts`、`index.ts`
- [x] 3.4 运行确认通过（6/6）

### Task 4: 收尾  ✅
- [x] 4.1 更新 `CHANGELOG.md` 1.3.1（设置时判断 + 渲染固定 + 显式优先）
- [x] 4.2 相关套件 124/124 通过；`npx tsc --noEmit` 通过
- [x] 4.3 代码审查（无 P0/P1）

## 状态日志
- 2026-10-09：设计确认（设置时一次、渲染固定），计划创建。
- 2026-10-09：Task 1-3 实现完成，相关套件 124/124 通过，tsc 通过。
- 2026-10-09：CHANGELOG 更新完成，代码审查通过。
- 2026-10-09：修复「图片加载前设置标题不生效」——新增 `adjustTitlePositions()`，在 `drawImage` onload 后补做一次判断；回归 125/125 通过。
