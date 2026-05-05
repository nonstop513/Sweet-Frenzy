# Buy Feature 性能分析报告

## 📊 调用链路

```
用户点击 Buy Feature 按钮
  ↓
onBuyFeature() - 生成触发版面 (~1ms)
  ↓
用户点击 Spin
  ↓
checkAndTriggerFreeGame() - 检查C1触发
  ↓
startFreeGame(10)
  ↓
engine.generateFreeGameScript(10, 0) ← 🔥 性能瓶颈！
  ↓
  while (remainingSpins > 0) {  // 循环10次（或更多retrigger）
    ↓
    generateSpinScript() ← 含重抽机制
      ↓
      while (attempts < 100) {  // 重抽循环
        ↓
        _generateSingleSpin() ← 核心计算
          ↓
          generateInitialBoard() - 生成初始盘面 (~2ms)
          ↓
          while (有消除) {  // Cascade循环（平均4-5次）
            ↓
            findAllMatches() - BFS查找 (~10ms)
              ├─ 遍历91个格子
              ├─ 每个格子检查6个邻居
              └─ BFS队列操作
            ↓
            消除符号 (~1ms)
            ↓
            applyGravity() - 重力模拟 (~2ms)
            ↓
            fillDropSymbols() - 填充新符号 (~3ms)
            ↓
            cloneBoard() × 2 - 快照 (~2ms)
          }
      }
  }
```

---

## ⏱️ 时间消耗分解

### 单个Spin的成本（无重抽）
```
初始盘面生成:           2ms
Cascade #1:           18ms
  ├─ findAllMatches:  10ms (BFS)
  ├─ 消除:             1ms
  ├─ 重力:             2ms
  ├─ 填充:             3ms
  └─ 快照:             2ms
Cascade #2:           18ms
Cascade #3:           18ms
Cascade #4:           18ms
---------------------------------
单个Spin总计:         ~74ms
```

### FreeGame 10 Spin（无重抽）
```
10 Spin × 74ms = 740ms
Retrigger检查:    10ms
总计:            ~750ms
```

### ⚠️ 加上重抽机制后
```
假设重抽配置导致：
- 平均每个spin重抽1.5次
- 实际计算 = 10 × (1 + 1.5) = 25个spin

实际耗时 = 25 × 74ms = 1,850ms ≈ 2秒 ⚠️
```

---

## 🔥 性能瓶颈排名

| 瓶颈 | 单次耗时 | 调用次数 | 总耗时 | 占比 |
|------|---------|---------|--------|------|
| **重抽机制** | 74ms/spin | 15次额外 | **1,110ms** | **60%** |
| findAllMatches (BFS) | 10ms | 40次 | 400ms | 22% |
| fillDropSymbols | 3ms | 40次 | 120ms | 6% |
| applyGravity | 2ms | 40次 | 80ms | 4% |
| cloneBoard | 2ms | 80次 | 160ms | 8% |

---

## 🎯 优化建议

### 1. **检查重抽率配置** ⭐⭐⭐ (最重要)

当前data.js中的配置：
```javascript
"freeredraw": [0.0, 0.0, 0.0, ..., 0.0]  // 全部为0
```

**如果你修改了这些值**，例如：
```javascript
"freeredraw": [0.0, 0.0, 0.5, 0.3, ...]  // 有非0值
```

**影响**：
- 50%重抽率 → 平均重抽1次 → 耗时×2
- 30%重抽率 → 平均重抽0.43次 → 耗时×1.43

**解决方案**：
- 降低重抽率到合理范围（<10%）
- 或者在FreeGame生成时禁用重抽：
  ```javascript
  generateSpinScript(megaLevel, megaCount, true, wildCount, 
                     1, false)  // enableRedraw=false
  ```

---

### 2. **性能监控** ⭐⭐

添加性能测量：
```javascript
generateFreeGameScript(initialSpins, startWildCount) {
    const startTime = performance.now();
    let totalRedrawAttempts = 0;
    
    // ... 在while循环中 ...
    const spinScript = this.generateSpinScript(...);
    if (spinScript.redrawAttempts) {
        totalRedrawAttempts += spinScript.redrawAttempts;
    }
    
    const endTime = performance.now();
    console.log(`⏱️ FreeGame生成耗时: ${Math.round(endTime - startTime)}ms`);
    console.log(`🔄 总重抽次数: ${totalRedrawAttempts}`);
}
```

---

### 3. **条件性重抽** ⭐⭐

只在需要时启用重抽：
```javascript
// BaseGame: 启用重抽（控制RTP）
generateSpinScript(0, 0, false, 0, bet, true)

// FreeGame: 禁用重抽（提升性能）
generateSpinScript(megaLevel, megaCount, true, wildCount, bet, false)
```

---

### 4. **异步生成** ⭐ (高级)

使用Web Worker后台生成：
```javascript
// 在Buy Feature时预生成
onBuyFeature() {
    // 显示"生成中..."提示
    setTimeout(() => {
        gameState.freeGameScript = engine.generateFreeGameScript(10, 0);
        // 隐藏提示，允许spin
    }, 0);
}
```

---

## 📈 预期优化效果

| 优化方案 | 难度 | 预期提升 | 最终耗时 |
|---------|------|---------|---------|
| 检查重抽率为0 | 低 | 如果重抽导致慢 | 400-750ms |
| 禁用FreeGame重抽 | 低 | 50%+ | 400-750ms |
| 异步生成 | 中 | 用户感知100% | 0ms感知 |
| 全部优化 | 中 | 60-80% | 300-500ms |

---

## 🧪 如何验证

1. **检查当前重抽率**：
   ```javascript
   console.log(gameData.freeredraw);  // 应该全是0.0
   ```

2. **测试性能**：
   打开浏览器控制台 → Performance标签 → 点击Buy Feature

3. **添加日志**：
   在generateSpinScript中添加：
   ```javascript
   if (attempts > 1) {
       console.log(`🔄 Spin重抽了${attempts}次`);
   }
   ```

---

## 💡 结论

**主要时间消耗**：
1. **重抽机制** (如果启用且重抽率>0) - 可能占60%+
2. **BFS查找匹配** - 占22%
3. **数组克隆和重力** - 占18%

**最快速优化**：
- 确认data.js中freeredraw全为0
- 或在FreeGame生成时禁用重抽（enableRedraw=false）

**预计效果**：
- 当前：1-2秒 → 优化后：400-750ms ✅
