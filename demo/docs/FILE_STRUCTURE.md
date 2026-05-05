# 📁 项目文件结构

## 整理后的目录树

```
demo/
│
├── 📄 README.md                    # 项目说明文档
│
├── 🎮 核心文件
│   ├── index.html                  # 游戏主页面
│   ├── game.js                     # 游戏UI逻辑
│   ├── engine.js                   # 游戏引擎核心 (1140行)
│   ├── data.js                     # 游戏配置数据 (23300行)
│   └── style.css                   # 样式文件
│
├── 📚 docs/                        # 📖 文档目录
│   ├── GAME_RULES.md              # 游戏规则完整说明
│   ├── PERFORMANCE_ANALYSIS.md     # 性能分析报告
│   ├── PERFORMANCE_OPTIMIZATION.md # 性能优化记录
│   ├── WEB_WORKER_GUIDE.md        # Web Worker 使用指南
│   ├── WEB_WORKER_SOLUTIONS.md    # Worker 解决方案对比
│   ├── 13MS_MYSTERY.md            # 13ms 性能问题分析
│   └── BFS_ZERO_FIX.md            # BFS=0 问题修复记录
│
├── 🧪 tests/                      # 🔬 测试工具目录
│   │
│   ├── 性能测试工具 ⭐
│   │   ├── performance_test.html          # 综合性能测试（推荐）
│   │   ├── detailed_timing_test.html      # 详细计时分析
│   │   ├── performance_breakdown.html     # 性能分解分析
│   │   └── performance_profiler.html      # 性能分析器
│   │
│   ├── 诊断工具 🔍
│   │   ├── hook_diagnosis.html            # Hook 机制诊断
│   │   ├── redraw_diagnosis.html          # 重抽机制诊断
│   │   └── test_performance.html          # 基础性能测试
│   │
│   └── Worker 测试 👷
│       ├── worker_test_inline.html        # 内联 Worker（无需服务器）⭐
│       ├── worker_test.html               # 外部 Worker（需要服务器）
│       └── worker_demo.html               # Worker 演示
│
├── 👷 workers/                    # Web Worker 文件
│   └── engine-worker.js           # 游戏引擎 Worker 实现
│
├── 📜 scripts/                    # 辅助脚本
│   ├── start_server.bat          # 启动本地HTTP服务器
│   └── simulation_numba.py       # Python 性能仿真脚本
│
└── 🖼️ img/                        # 图片资源
    ├── main_texture0_level1.avif
    └── main_texture0_level1 - 複製.avif
```

---

## 📊 文件统计

| 类型 | 数量 | 说明 |
|------|------|------|
| 核心文件 | 5 | 游戏主要逻辑 |
| 文档 | 7 | Markdown 文档 |
| 测试工具 | 10 | HTML 测试页面 |
| Worker | 1 | Web Worker 文件 |
| 脚本 | 2 | 辅助脚本 |
| 图片 | 2 | 游戏资源 |
| **总计** | **27** | |

---

## 🎯 快速访问

### **常用文件**

```bash
# 🎮 游戏主页
index.html

# 📊 性能测试（最常用）
tests/performance_test.html

# 🔬 详细计时分析
tests/detailed_timing_test.html

# 👷 Worker 测试（无需服务器）
tests/worker_test_inline.html

# 📖 游戏规则说明
docs/GAME_RULES.md

# ⚡ 性能优化记录
docs/PERFORMANCE_OPTIMIZATION.md
```

---

## 📂 文件夹用途说明

### **docs/** - 文档目录
存放所有 Markdown 文档，包括：
- 游戏规则说明
- 性能分析报告
- 技术指南
- 问题诊断记录

### **tests/** - 测试工具目录
存放所有 HTML 测试工具，包括：
- 性能测试工具
- 诊断工具
- Worker 测试工具

**注意**：这些文件已更新路径引用：
```html
<!-- 已自动更新为相对路径 -->
<script src="../data.js"></script>
<script src="../engine.js"></script>
```

### **workers/** - Web Worker 文件
存放 Worker 相关的 JavaScript 文件

**使用方式**：
```javascript
// 从 tests/ 目录引用
const worker = new Worker('../workers/engine-worker.js');
```

### **scripts/** - 辅助脚本
存放启动脚本、Python 仿真等工具

---

## 🔧 路径引用说明

### **测试文件路径更新**

所有 `tests/` 目录下的 HTML 文件已自动更新路径：

```html
<!-- ✅ 更新后（正确） -->
<script src="../data.js"></script>
<script src="../engine.js"></script>

<!-- ❌ 更新前（错误） -->
<script src="data.js"></script>
<script src="engine.js"></script>
```

### **Worker 路径更新**

Worker 测试文件已更新引用路径：

```javascript
// ✅ 更新后（正确）
const worker = new Worker('../workers/engine-worker.js');

// ❌ 更新前（错误）
const worker = new Worker('engine-worker.js');
```

---

## 📈 整理前后对比

### **整理前（根目录）**
```
❌ 27 个文件混杂在一起
❌ 难以找到需要的文件
❌ 文档和测试工具混在一起
```

### **整理后（分类清晰）**
```
✅ 根目录只保留 5 个核心文件
✅ 文档统一在 docs/
✅ 测试工具统一在 tests/
✅ 各司其职，结构清晰
```

---

## 🚀 使用建议

### **开发时**
```bash
# 编辑核心逻辑
engine.js
data.js
game.js

# 查看文档
docs/GAME_RULES.md
docs/PERFORMANCE_OPTIMIZATION.md
```

### **测试时**
```bash
# 性能测试
tests/performance_test.html

# 诊断问题
tests/hook_diagnosis.html
tests/redraw_diagnosis.html
```

### **部署时**
```bash
# 只需要核心文件
index.html
game.js
engine.js
data.js
style.css
img/

# 可选：Worker 支持
workers/engine-worker.js
```

---

## 📝 注意事项

1. **测试文件路径已更新** - 所有测试 HTML 自动更新了引用路径
2. **Worker 文件已移动** - 使用时注意路径为 `../workers/`
3. **文档统一管理** - 所有 MD 文件在 `docs/` 目录
4. **核心文件保持原位** - 主要逻辑文件仍在根目录

---

**整理完成时间：** 2026-04-20

**整理目标：** ✅ 从 27 个杂乱文件整理为清晰的 4 个文件夹结构
