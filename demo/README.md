# 🎰 瘋狂果醬罐 Slot Game

六角网格 Slot 游戏引擎 - 支持 BaseGame、FreeGame、Mega 系统

---

## 📁 项目结构

```
demo/
├── 📄 核心文件
│   ├── index.html          # 主页面
│   ├── style.css           # 样式文件
│   ├── game.js             # 游戏主逻辑
│   ├── engine.js           # 游戏引擎核心
│   └── data.js             # 游戏配置数据
│
├── 📚 docs/                # 文档目录
│   ├── GAME_RULES.md       # 游戏规则说明
│   ├── PERFORMANCE_ANALYSIS.md         # 性能分析报告
│   ├── PERFORMANCE_OPTIMIZATION.md     # 性能优化记录
│   ├── WEB_WORKER_GUIDE.md            # Web Worker 使用指南
│   ├── WEB_WORKER_SOLUTIONS.md        # Worker 解决方案
│   ├── 13MS_MYSTERY.md                # 13ms 性能问题分析
│   └── BFS_ZERO_FIX.md                # BFS 调用次数为 0 问题修复
│
├── 🧪 tests/               # 测试工具目录
│   ├── performance_test.html          # 性能测试主工具 ⭐
│   ├── detailed_timing_test.html      # 详细计时分析
│   ├── hook_diagnosis.html            # Hook 诊断工具
│   ├── redraw_diagnosis.html          # 重抽机制诊断
│   ├── performance_breakdown.html     # 性能分解分析
│   ├── performance_profiler.html      # 性能分析器
│   ├── test_performance.html          # 基础性能测试
│   ├── worker_test.html               # Worker 测试（外部文件）
│   ├── worker_test_inline.html        # Worker 测试（内联版）⭐
│   └── worker_demo.html               # Worker 演示
│
├── 👷 workers/             # Web Worker 文件
│   └── engine-worker.js               # 游戏引擎 Worker
│
├── 📜 scripts/             # 辅助脚本
│   ├── start_server.bat               # 启动本地服务器
│   └── simulation_numba.py            # Python 仿真脚本
│
└── 🖼️ img/                 # 图片资源
    ├── main_texture0_level1.avif
    └── main_texture0_level1 - 複製.avif
```

---

## 🚀 快速开始

### **方法 1：直接打开（推荐用于测试）**
```bash
# 打开主页面
index.html

# 打开性能测试工具
tests/performance_test.html
```

### **方法 2：使用本地服务器（支持 Worker）**
```bash
# 启动服务器
scripts/start_server.bat

# 然后访问
http://localhost:8000
http://localhost:8000/tests/worker_test_inline.html
```

---

## 🧪 测试工具说明

### **性能测试工具**

| 工具 | 用途 | 推荐度 |
|------|------|--------|
| **performance_test.html** | 综合性能测试，统计 BFS、重抽等指标 | ⭐⭐⭐⭐⭐ |
| **detailed_timing_test.html** | 详细计时分析，逐 Spin 测量 | ⭐⭐⭐⭐ |
| **hook_diagnosis.html** | 诊断 Hook 机制是否工作 | ⭐⭐⭐ |
| **redraw_diagnosis.html** | 诊断重抽机制配置 | ⭐⭐⭐ |

### **Worker 测试工具**

| 工具 | 用途 | 是否需要服务器 |
|------|------|----------------|
| **worker_test_inline.html** | 内联 Worker 测试（推荐） | ❌ 不需要 |
| **worker_test.html** | 外部 Worker 测试 | ✅ 需要 |
| **worker_demo.html** | Worker 演示 | ✅ 需要 |

---

## 📊 性能指标

### **当前性能（优化后）**

```
✅ FreeGame (10 Spin): 6-10 ms
✅ 平均每 Spin: 0.6-1.0 ms
✅ BFS 调用: 800-1000 次
✅ 重抽次数: 0（当前配置）
```

### **优化项目**

- ✅ BFS 队列索引优化（避免 shift）
- ✅ 数组复用（visitedCache, wildInQueueCache）
- ✅ 条件日志（避免不必要的字符串拼接）
- ✅ 重抽率设为 0%（避免重复计算）

---

## 📚 文档说明

### **核心文档**

- **GAME_RULES.md** - 完整的游戏规则说明
- **PERFORMANCE_OPTIMIZATION.md** - 性能优化历程和技术细节

### **问题诊断文档**

- **13MS_MYSTERY.md** - 为什么测试显示 13ms？
- **BFS_ZERO_FIX.md** - BFS 调用次数为 0 的问题修复

### **技术指南**

- **WEB_WORKER_GUIDE.md** - Web Worker 完整使用指南
- **WEB_WORKER_SOLUTIONS.md** - 各种 Worker 实现方案对比

---

## 🔧 开发说明

### **核心引擎文件**

```javascript
// data.js - 游戏配置
- 符号权重、Drop 配置、倍数表
- baseredraw/freeredraw 重抽率配置

// engine.js - 游戏引擎
- BaseGame/FreeGame/Mega 生成逻辑
- BFS 连通性查找
- Cascade 消除系统
- 重抽机制

// game.js - 游戏主逻辑（UI交互）
```

### **修改配置**

编辑 `data.js`：

```javascript
// 修改重抽率（0.0 = 不重抽）
"baseredraw": [0.0, 0.0, ..., 0.0]
"freeredraw": [0.0, 0.0, ..., 0.0]

// 修改符号权重
"M1": [20, 20, 20, 20, 20, 20, 20, 20]
```

---

## 🎮 游戏特性

### **核心玩法**
- ✅ 六角网格布局（7行，不同列数）
- ✅ BFS 连通性查找（≥6 个相邻符号消除）
- ✅ Cascade 连消系统
- ✅ Wild 符号（可替代任意符号）
- ✅ MY 符号（9/10/11 转换为 0-8）

### **游戏模式**
- **BaseGame** - 基础游戏
- **FreeGame** - 免费游戏（10 spin）
- **Mega** - Mega 钻石系统

### **重抽机制**
- 根据倍数区间设置重抽率
- 支持 BaseGame 和 FreeGame 独立配置
- 可完全禁用（设为 0.0）

---

## 📈 性能测试

### **快速性能测试**

1. 打开 `tests/performance_test.html`
2. 点击"测试 FreeGame (10 Spin)"
3. 查看结果：
   - ⏱️ 总生成时间
   - 🔍 BFS 调用次数
   - 🔄 重抽次数

### **详细性能分析**

1. 打开 `tests/detailed_timing_test.html`
2. 点击"重复测试 10 次"
3. 查看稳定性分析

---

## 🐛 问题排查

### **性能问题**
- 检查 `data.js` 中的重抽率配置
- 使用 `tests/redraw_diagnosis.html` 诊断

### **BFS 统计异常**
- 使用 `tests/hook_diagnosis.html` 检查 Hook 机制
- 确认方法名正确（`findConnectedGroup`，单数）

### **Worker 不工作**
- 确认使用 `worker_test_inline.html`（内联版）
- 或启动本地服务器使用 `worker_test.html`

---

## 📝 更新日志

### **v1.0 - 性能优化版**
- ✅ 完成 BFS 性能优化
- ✅ 实现数组复用机制
- ✅ 添加重抽机制
- ✅ 修复 Hook 统计问题
- ✅ 性能提升至 6-10ms/10spins

---

## 🤝 贡献

如需修改或扩展功能，请参考 `docs/` 中的文档。

---

**Enjoy! 🎰**
