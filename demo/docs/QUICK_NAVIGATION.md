# 🚀 快速导航

快速访问常用文件和工具

---

## 🎮 游戏运行

| 文件 | 说明 | 路径 |
|------|------|------|
| **主游戏** | 游戏主页面 | [index.html](../index.html) |
| **启动服务器** | 本地HTTP服务器 | [scripts/start_server.bat](../scripts/start_server.bat) |

---

## 🧪 性能测试工具

### **推荐使用** ⭐

| 工具 | 用途 | 路径 |
|------|------|------|
| **综合性能测试** | BFS统计、重抽分析、全面测试 | [tests/performance_test.html](../tests/performance_test.html) |
| **详细计时测试** | 逐Spin分析、稳定性测试 | [tests/detailed_timing_test.html](../tests/detailed_timing_test.html) |
| **Worker测试（内联）** | 异步生成测试（无需服务器） | [tests/worker_test_inline.html](../tests/worker_test_inline.html) |

### **专项诊断工具**

| 工具 | 用途 | 路径 |
|------|------|------|
| **Hook诊断** | 检查BFS统计是否正常 | [tests/hook_diagnosis.html](../tests/hook_diagnosis.html) |
| **重抽诊断** | 检查重抽率配置 | [tests/redraw_diagnosis.html](../tests/redraw_diagnosis.html) |
| **性能分解** | 分析各部分耗时 | [tests/performance_breakdown.html](../tests/performance_breakdown.html) |

---

## 📚 文档查阅

### **核心文档**

| 文档 | 内容 | 路径 |
|------|------|------|
| **项目说明** | 项目概览、快速开始 | [README.md](../README.md) |
| **文件结构** | 完整目录树、整理记录 | [FILE_STRUCTURE.md](FILE_STRUCTURE.md) |
| **游戏规则** | 完整游戏规则说明 | [GAME_RULES.md](GAME_RULES.md) |

### **性能优化文档**

| 文档 | 内容 | 路径 |
|------|------|------|
| **性能优化记录** | 优化历程、技术细节 | [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md) |
| **性能分析** | 性能瓶颈分析 | [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md) |

### **问题诊断文档**

| 文档 | 内容 | 路径 |
|------|------|------|
| **13ms之谜** | 为什么显示13ms？ | [13MS_MYSTERY.md](13MS_MYSTERY.md) |
| **BFS调用为0修复** | BFS统计问题解决 | [BFS_ZERO_FIX.md](BFS_ZERO_FIX.md) |

### **技术指南**

| 文档 | 内容 | 路径 |
|------|------|------|
| **Web Worker指南** | Worker完整使用教程 | [WEB_WORKER_GUIDE.md](WEB_WORKER_GUIDE.md) |
| **Worker方案对比** | 各种实现方案比较 | [WEB_WORKER_SOLUTIONS.md](WEB_WORKER_SOLUTIONS.md) |

---

## 🔧 开发文件

### **核心代码**

| 文件 | 说明 | 行数 | 路径 |
|------|------|------|------|
| **引擎核心** | 游戏逻辑引擎 | ~1140 | [engine.js](../engine.js) |
| **游戏配置** | 权重、倍数等配置 | ~23300 | [data.js](../data.js) |
| **游戏UI** | UI交互逻辑 | - | [game.js](../game.js) |
| **主页面** | HTML结构 | - | [index.html](../index.html) |
| **样式** | CSS样式 | - | [style.css](../style.css) |

### **Worker文件**

| 文件 | 说明 | 路径 |
|------|------|------|
| **引擎Worker** | 后台线程引擎 | [workers/engine-worker.js](../workers/engine-worker.js) |

---

## 📊 常见任务快速指南

### **测试性能**
```
1. 打开 tests/performance_test.html
2. 点击"测试 FreeGame (10 Spin)"
3. 查看结果
```

### **诊断BFS统计问题**
```
1. 打开 tests/hook_diagnosis.html
2. 依次点击 4 个测试按钮
3. 查看统计结果
```

### **检查重抽配置**
```
1. 打开 tests/redraw_diagnosis.html
2. 查看当前配置
3. 运行对比测试
```

### **测试Worker异步生成**
```
1. 打开 tests/worker_test_inline.html
2. 点击"Worker模式"测试
3. 对比同步模式
```

### **修改游戏配置**
```
1. 编辑 data.js
2. 修改重抽率、权重等配置
3. 刷新测试页面验证
```

---

## 🎯 推荐工作流

### **性能测试工作流**
```
1. 修改配置 (data.js)
   ↓
2. 快速测试 (tests/performance_test.html)
   ↓
3. 详细分析 (tests/detailed_timing_test.html)
   ↓
4. 查看文档 (docs/PERFORMANCE_OPTIMIZATION.md)
```

### **问题诊断工作流**
```
1. 发现问题
   ↓
2. Hook诊断 (tests/hook_diagnosis.html)
   ↓
3. 查看文档 (docs/*.md)
   ↓
4. 修复问题 (engine.js / data.js)
```

---

## 🔗 相关链接

- [项目主页](../index.html)
- [性能测试工具](../tests/)
- [文档目录](.)
- [测试工具目录](../tests/)
- [Worker文件](../workers/)

---

**更新时间：** 2026-04-20

**快速导航版本：** v1.0
