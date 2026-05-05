# 性能优化方案

## 当前状态
- **目标**: 10 spin FreeGame生成
- **当前耗时**: 1-2秒
- **理论计算量**: 约50,000次操作（应该<10ms）
- **实际瓶颈**: 数据结构和算法开销

## 已完成优化 ✓
1. 关闭详细日志（verboseLog=false）
2. 减少board快照（performanceMode=true）
3. 条件性clone（只保留必要的boardAfterGravity/Fill）

## 🔥 进一步优化方案

### 1. 修复BFS队列性能（**预计提升70%**）
**问题**: `queue.shift()` 是O(n)操作，每次移动整个数组

```javascript
// ❌ 目前（慢）
while (queue.length > 0) {
    const current = queue.shift();  // O(n)！
    // ...
}

// ✅ 优化：使用索引
let queueIndex = 0;
while (queueIndex < queue.length) {
    const current = queue[queueIndex++];  // O(1)
    // ...
}
```

**影响**: 40次cascade × 91格 × 30% BFS触发 ≈ 1,092次shift → **节约约500ms**

---

### 2. 移除字符串模板计算（**预计提升15%**）
**问题**: 即使不输出，模板字符串仍会被构建

```javascript
// ❌ 目前（慢）
this.log(`消除: ${match.positions.length}個...`);  // 字符串仍被构建

// ✅ 优化：条件性构建
if (this.verboseLog) {
    console.log(`消除: ${match.positions.length}個...`);
}
```

**建议**: 检查所有`this.log()`调用，改为直接if判断

---

### 3. 复用visited数组（**预计提升10%**）
**问题**: 每次findAllMatches重新创建7×13数组

```javascript
// ❌ 目前
findAllMatches(board) {
    const visited = Array(7).fill(null).map(() => Array(13).fill(false));
    // ...
}

// ✅ 优化：复用并重置
constructor() {
    this.visitedCache = Array(7).fill(null).map(() => Array(13).fill(false));
}

findAllMatches(board) {
    // 重置（比重新创建快）
    for (let r = 0; r < 7; r++) {
        this.visitedCache[r].fill(false);
    }
    // ...
}
```

---

### 4. 对象池复用（高级优化）
**问题**: 大量position对象创建压力

```javascript
// ✅ 复用position对象
class PositionPool {
    constructor(size = 1000) {
        this.pool = Array(size).fill(null).map(() => ({row: 0, col: 0}));
        this.index = 0;
    }
    
    get(row, col) {
        const pos = this.pool[this.index++ % this.pool.length];
        pos.row = row;
        pos.col = col;
        return pos;
    }
    
    reset() { this.index = 0; }
}
```

---

## 预计优化效果

| 优化项 | 预计提升 | 难度 | 优先级 |
|--------|---------|------|--------|
| BFS队列索引 | 70% | 低 | ⭐⭐⭐ |
| 移除字符串模板 | 15% | 低 | ⭐⭐ |
| 复用visited数组 | 10% | 低 | ⭐⭐ |
| 对象池 | 5% | 中 | ⭐ |

**总预计**: 1-2秒 → **100-300ms** 🚀

---

## 实施步骤

### 快速优化（10分钟）- 推荐
1. 修复BFS queue.shift() → 索引访问
2. visited数组复用
3. 移除关键路径的字符串模板

### 完整优化（30分钟）
4. 检查所有log调用
5. 对象池实现
6. 性能测试验证

---

## 为什么需要这么长时间？

**JavaScript的性能特性**:
- ✓ 简单运算很快（算数、比较）
- ✗ 数组操作慢（shift/unshift/splice）
- ✗ 对象创建/GC压力大
- ✗ 字符串拼接有开销
- ✗ 单线程无法并行

**对比其他语言**:
- C++/Rust: 同样计算约10-20ms
- Python: 约200-500ms（比JS慢但有NumPy优化）
- JavaScript: 1-2秒（受数据结构影响）

**关键**: JS需要算法级优化，不能只靠减少计算量
