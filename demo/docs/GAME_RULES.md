# 瘋狂果醬罐 - 游戏规则文档

## 📋 目录
- [游戏概述](#游戏概述)
- [盘面结构](#盘面结构)
- [Base Game 规则](#base-game-规则)
- [Free Game 规则](#free-game-规则)
- [Wild 符号系统](#wild-符号系统)
- [Mega 消除系统](#mega-消除系统)
- [data.js 参数说明](#datajs-参数说明)
- [完整游戏流程示例](#完整游戏流程示例)
- [HTML Demo 开发指南](#html-demo-开发指南)

---

## 游戏概述

瘋狂果醬罐是一款六角网格消除类游戏，具有以下特色：
- **六角网格布局**：[4, 5, 6, 7, 6, 5, 4]
- **中央Wild符号**：位于 [3,6]，永久固定
- **消除机制**：6个或以上相连符号消除
- **Cascade系统**：消除后符号下落，连续触发
- **Mega符号**：通过Wild等级累积触发特殊奖励

---

## 盘面结构

### 六角网格布局
```
Row 0:    ◯ ◯ ◯ ◯           [4个格子]
Row 1:   ◯ ◯ ◯ ◯ ◯          [5个格子]
Row 2:  ◯ ◯ ◯ ◯ ◯ ◯         [6个格子]
Row 3: ◯ ◯ ◯ W ◯ ◯ ◯        [7个格子，W=Wild]
Row 4:  ◯ ◯ ◯ ◯ ◯ ◯         [6个格子]
Row 5:   ◯ ◯ ◯ ◯ ◯          [5个格子]
Row 6:    ◯ ◯ ◯ ◯           [4个格子]
```

### 坐标系统
实际列坐标（用于相连判断）：
- Row 0: [3, 5, 7, 9]
- Row 1: [2, 4, 6, 8, 10]
- Row 2: [1, 3, 5, 7, 9, 11]
- Row 3: [0, 2, 4, **6**, 8, 10, 12]  ← Wild 在 [3,6]
- Row 4: [1, 3, 5, 7, 9, 11]
- Row 5: [2, 4, 6, 8, 10]
- Row 6: [3, 5, 7, 9]

### 六方向相连
每个格子可以与 6 个方向的格子相连：
- 左上、右上、左、右、左下、右下

---

## Base Game 规则

### 1. 初始化盘面
从 `data.js` 抽选参数：
1. **选择 Reel Set** (1-5)
   - 根据 `ReelWeight` 权重随机选择
   - 例如：`[200, 600, 600, 800, 300]`

2. **加载对应的 Reel 数据**
   ```javascript
   // 假设抽到 reel_set = 3
   const symbolsData = data.BaseGameSymbol3;  // 每行的符号列表
   const weightsData = data.BaseGameRWeight3; // 每行的权重
   const myWeights = data.BaseGameMY3;        // MY符号转换权重
   ```

3. **生成初始符号**
   - 每行独立，按权重抽选符号
   - 中央 [3,6] 固定为 Wild (ID=0)
   - 每行最多 1 个 C1 符号

### 2. 消除流程

#### Cascade 循环
```
while (有符号组 >= 6 个相连) {
    1. 查找所有符号组（BFS算法）
    2. 计算分数并消除
       - 不含Wild：基底分数 × 1
       - 含Wild：基底分数 × Wild倍数
    3. 更新Wild系统
       - 如果含Wild：wild_eliminate_count++
       - 更新mega_level（见Mega系统）
    4. 符号下落填补空位
    5. 填充新符号
       - 选择 Drop Set (1-6)
       - 根据 eliminate_count 选择权重行
}

// 无法继续消除时
if (mega_eliminate_count > 0) {
    放置 mega_eliminate_count 个钻石形状
    继续 Cascade
}
```

#### Drop Set 选择
根据 `eliminate_count` 从 `DropWeight` (10行×6列) 选择：
- 第1次消除 → 使用第0行权重
- 第2次消除 → 使用第1行权重
- ...
- 第10+次消除 → 使用第9行权重

#### 分数计算
```javascript
// 从 linkpoint 表查询基底分数
const symbolIndex = symbol - 2;  // M2→0, M3→1, ...
const countIndex = count - 6;     // 6个→0, 7个→1, ...
const baseScore = linkpoint[symbolIndex][countIndex];

// 应用Wild倍数
if (containsWild) {
    const wildMult = getWildMultiplier(wild_eliminate_count);
    finalScore = baseScore * wildMult;
} else {
    finalScore = baseScore * 1;
}
```

### 3. Wild 倍数系统

**倍数序列**：[1, 1, 2, 4, 6, 8, 10, 12, ..., 1000]
```javascript
function getWildMultiplier(eliminateCount) {
    if (eliminateCount <= 1) return 1;
    if (eliminateCount === 2) return 2;
    return Math.min(2 + (eliminateCount - 2) * 2, 1000);
}
```

**重置规则**：
- **Base Game**：每次 spin 重置为 0
- **Free Game**：整场保留累积

### 4. Mega 消除系统

#### Mega 等级累积
```
mega_level 范围：0, 1, 2
mega_eliminate_count 范围：0, 1, 2, 3

当符号消除包含Wild时：
  计算Wild帮助的组数 wild_group_count
  
  if (mega_eliminate_count < 3) {
      增加量 = min(wild_group_count, 2)  // 最多+2
      mega_level = min(mega_level + 增加量, 2)  // 上限2
      
      if (mega_level == 2) {
          mega_eliminate_count++  // 完成一个循环
          mega_level = 0
      }
  }
  // 达到3后不再提升
```

#### Mega 符号放置

**触发条件**：无法继续消除且 `mega_eliminate_count > 0`

**钻石形状定义**（4格）：
```
中心点 [r, c] 的钻石形状：
- [r, c]      中心
- [r, c-2]    左
- [r+1, c-1]  下左
- [r+1, c+1]  下右
```

**放置规则**：
1. 从 `Eliminate` 权重抽选符号（只抽一次）
2. 所有钻石使用同一符号
3. 放置数量 = `mega_eliminate_count`
4. 限制：
   - 不能覆盖中央Wild [3,6]
   - 不能互相覆盖
   - 不能覆盖C1符号
   - 第一个钻石必须与现有相同符号相邻

**可放置中心点**（预定义24个位置）：
```
Row 0: (0,5), (0,7), (0,9)
Row 1: (1,4), (1,6), (1,8), (1,10)
Row 2: (2,3), (2,9), (2,11)
Row 3: (3,2), (3,4), (3,10), (3,12)
Row 4: (4,3), (4,5), (4,7), (4,9), (4,11)
Row 5: (5,4), (5,6), (5,8)
```

**放置后**：重置 `mega_eliminate_count = 0`, `mega_level = 0`

---

## Free Game 规则

### 1. 触发条件
- Base Game 中获得指定数量的 Scatter 符号（具体条件待定）

### 2. 初始 Spins
- 默认：10 次免费旋转

### 3. Retrigger 机制
每次 spin 结束后，检查盘面 C1 数量：
```javascript
const c1Count = countC1OnBoard();
const retriggerMap = {
    3: 10,   // 3个C1 → +10 spins
    4: 12,   // 4个C1 → +12 spins
    5: 15,   // 5个C1 → +15 spins
    6: 20,   // 6个C1 → +20 spins
    7: 30    // 7个C1 → +30 spins
};
if (c1Count in retriggerMap) {
    remainingSpins += retriggerMap[c1Count];
}
```

### 4. 参数选择
使用 Free Game 专用参数：
- `FreeReelWeight` → 选择 Reel Set
- `FreeGameSymbol{N}` → 符号列表
- `FreeGameRWeight{N}` → 符号权重
- `FreeGameMY{N}` → MY转换权重
- `FreeDropWeight` → Drop权重 (10行×6列)
- `FreeEliminate` → Mega符号权重

### 5. 跨Spin累积（关键差异）

**保留状态**：
- `wild_eliminate_count` → Wild倍数持续累积
- `mega_level` → Mega等级保留
- `mega_eliminate_count` → Mega计数保留

```javascript
// Free Game 示例
Spin 1: wild_eliminate_count: 0→3, mega_level: 0→1
Spin 2: wild_eliminate_count: 3→5, mega_level: 1→2→0
        mega_eliminate_count: 0→1
Spin 3: wild_eliminate_count: 5→8, mega_level: 0→2→0
        mega_eliminate_count: 1→2
...持续累积直到 Free Game 结束
```

---

## Wild 符号系统

### Wild 特性
1. **位置**：固定在 [3,6]
2. **万能匹配**：可与任何符号 (M2-M8) 形成连通
3. **不被消除**：参与消除但自身不清除
4. **多组参与**：可同时帮助多个符号组消除

### Wild 参与检测
```javascript
function checkWildInGroup(positions) {
    for (const [row, col] of positions) {
        if (row === 3 && col === 6) {
            return true;  // 包含Wild
        }
    }
    return false;
}
```

### 倍数应用示例
```
同一次 Cascade:
  组1: 7个M1含Wild → 1000 × Wild倍数(2) = 2000
  组2: 6个M2不含Wild → 500 × 1 = 500
  组3: 8个M3含Wild → 1500 × Wild倍数(2) = 3000
  
  Wild帮助了2组 → mega_level += 2
```

---

## MY 符号转换系统

### MY 符号说明
- **MY1 (ID=9)**、**MY2 (ID=10)**、**MY3 (ID=11)** 是辅助符号
- 这些符号在初始化盘面后会自动转换为 M1-M7 之一
- 转换规则由 `data.js` 中的 MY 权重决定

### 转换时机
```javascript
// 初始化流程
1. 按照 Reel 数据生成盘面（可能包含MY符号）
2. 对每个MY符号，根据MY权重转换为M1-M7
3. 确保每行最多1个C1
4. 设置中央Wild
```

### MY 权重使用

从 `data.js` 加载 MY 权重：
```javascript
// Base Game
const myWeights = data.BaseGameMY{N};  // N = reel_set (1-5)
// 示例结构：
// [
//   [w1_to_M1, w1_to_M2, ..., w1_to_M7],  // MY1的转换权重
//   [w2_to_M1, w2_to_M2, ..., w2_to_M7],  // MY2的转换权重
//   [w3_to_M1, w3_to_M2, ..., w3_to_M7]   // MY3的转换权重
// ]

// Free Game
const myWeights = data.FreeGameMY{N};
```

### 转换示例
```javascript
// 假设 BaseGameMY3 = [
//   [100, 200, 300, 200, 100, 50, 50],  // MY1权重
//   [50, 50, 100, 200, 300, 200, 100],  // MY2权重
//   [200, 100, 50, 50, 100, 200, 300]   // MY3权重
// ]

盘面初始化后包含：
- 位置[0,3]：MY1 (ID=9)
- 位置[2,5]：MY2 (ID=10)
- 位置[4,7]：MY3 (ID=11)

转换过程：
1. MY1 → 根据权重[100,200,300,200,100,50,50]抽选 → 可能变成M3
2. MY2 → 根据权重[50,50,100,200,300,200,100]抽选 → 可能变成M5
3. MY3 → 根据权重[200,100,50,50,100,200,300]抽选 → 可能变成M7

转换后盘面：
- 位置[0,3]：M3 (ID=4)
- 位置[2,5]：M5 (ID=6)
- 位置[4,7]：M7 (ID=8)
```

### Drop 过程中的 MY 转换

Drop 符号填充时也可能生成 MY 符号：
```javascript
// 每次填充新符号后
1. 从 Drop 轮带中获取符号（可能包含MY）
2. 为每种MY选择一个统一的转换目标
   - 本次填充中所有MY1转换为同一个符号
   - 本次填充中所有MY2转换为同一个符号
   - 本次填充中所有MY3转换为同一个符号
3. 执行转换
4. 修正C1数量（确保每行最多1个）
```

**注意**：
- 初始化时：每个MY独立转换
- Drop填充时：同类MY统一转换（避免过度随机）

---

## Mega 消除系统

### 完整流程图
```
┌─────────────────────────────────────┐
│ 符号消除（Cascade）                    │
└──────────┬──────────────────────────┘
           │
           ▼
   ┌───────────────┐
   │ 包含Wild？     │
   └───┬───────┬───┘
       YES     NO
       │       │
       ▼       └──────────────┐
   ┌─────────────────┐        │
   │ wild_group_count│        │
   │ (Wild帮助几组)  │        │
   └────────┬────────┘        │
            │                 │
            ▼                 │
   mega_eliminate_count < 3?  │
            │                 │
       YES  │  NO             │
       ▼    │   ▼             │
   提升等级  │  不提升         │
       │    │   │             │
       ▼    └───┴─────────────┘
   mega_level += min(wild_group_count, 2)
   mega_level = min(mega_level, 2)
       │
       ▼
   mega_level == 2?
       │
      YES
       │
       ▼
   mega_eliminate_count++
   mega_level = 0
       │
       └───────────────┐
                       │
┌──────────────────────▼──────┐
│ 无法继续消除                │
└──────────────────┬──────────┘
                   │
                   ▼
          mega_eliminate_count > 0?
                   │
                  YES
                   │
                   ▼
          ┌─────────────────────┐
          │ 放置Mega符号         │
          │ (钻石形状)           │
          │ 数量=mega_eliminate  │
          │      _count          │
          └──────────┬──────────┘
                     │
                     ▼
          重置：mega_eliminate_count = 0
                mega_level = 0
                     │
                     ▼
          继续Cascade循环
```

---

## data.js 参数说明

### Base Game 参数

#### Reel 相关
```javascript
"ReelWeight": [200, 600, 600, 800, 300]  // 5个Reel Set的权重

// Reel Set 1
"BaseGameSymbol1": [[...], [...], ...]   // 7行，每行的符号列表
"BaseGameRWeight1": [[...], [...], ...]  // 7行，每行的权重
"BaseGameMY1": [[...], [...], [...]]     // MY符号转换权重

// Reel Set 2-5 同理
```

#### Drop 相关
```javascript
"DropWeight": [
    [1000, 400, 1200, 850, 1200, 951],  // 第1次消除权重
    [1000, 400, 1200, 0, 1200, 951],    // 第2次消除权重
    // ... 共10行
]  // 10行×6列

// Drop Set 1
"BaseDrop1": [[...], [...], ...]         // 7行掉落轮带
"BaseDropP1": [1000, 1000, ...]          // 掉落方法权重
"BaseDropMY1": [[...], [...], [...]]     // 掉落MY权重

// Drop Set 2-6 同理
```

#### Mega 相关
```javascript
"Eliminate": [0, 0, 100, 110, 120, 150, 150, 180, 180]
// 9个权重，对应符号索引
// 索引0,1权重为0 → 符号2,3不会被选为Mega
// 索引2权重100 → 符号4有机会
```

#### 其他
```javascript
"linkpoint": [[...], [...], ...]  // 7×11 分数表
```

### Free Game 参数
结构与 Base Game 相同，但使用 `Free` 前缀：
```javascript
"FreeReelWeight": [...]
"FreeGameSymbol1": [...]
"FreeDropWeight": [...]  // 10行×6列
"FreeEliminate": [...]
```

---

## 完整游戏流程示例

### Base Game 示例

```javascript
// === Spin 开始 ===
wild_eliminate_count = 0
mega_level = 0
mega_eliminate_count = 0

// 1. 选择参数
const reelSet = weightedChoice([200,600,600,800,300]); // → 3
const symbols = data.BaseGameSymbol3;
const weights = data.BaseGameRWeight3;

// 2. 初始化盘面
initializeBoard(symbols, weights);
board[3][6] = 0;  // Wild

// 3. Cascade 循环
// --- Cascade 1 ---
findMatches();  // → 找到 2组：7个M3含Wild, 6个M4不含Wild
removeAndScore();
  组1: 1000 × 1 = 1000 (wild_eliminate_count从0→1，倍数仍为1)
  组2: 500 × 1 = 500
  wild_group_count = 1
  mega_level: 0 → 1

dropSymbols();
fillEmpty(eliminate_count=1);  // 使用DropWeight第0行

// --- Cascade 2 ---
findMatches();  // → 找到 1组：8个M2含Wild
removeAndScore();
  组1: 1500 × 1 = 1500 (wild_eliminate_count从1→2，倍数仍为1)
  wild_group_count = 1
  mega_level: 1 → 2 → 完成循环
  mega_eliminate_count: 0 → 1
  mega_level: 2 → 0

dropSymbols();
fillEmpty(eliminate_count=2);  // 使用DropWeight第1行

// --- Cascade 3 ---
findMatches();  // → 找到 2组：6个M5含Wild, 7个M6含Wild
removeAndScore();
  组1: 800 × 2 = 1600 (wild_eliminate_count从2→3，倍数为2)
  组2: 1200 × 2 = 2400
  wild_group_count = 2
  mega_level: 0 → 2 → 完成循环
  mega_eliminate_count: 1 → 2
  mega_level: 2 → 0

dropSymbols();
fillEmpty(eliminate_count=3);

// --- 无法继续消除 ---
// mega_eliminate_count = 2 → 放置2个Mega钻石
placeMegaSymbols(2);
  从 Eliminate 抽选符号 → M4
  放置2个M4钻石形状

// --- Cascade 4 (Mega触发) ---
findMatches();  // → 找到 1组：10个M4含Wild
removeAndScore();
  组1: 3000 × 4 = 12000 (wild_eliminate_count从3→4，倍数为4)
  mega_eliminate_count重置为0

// ... 继续直到无法消除
```

### Free Game 示例

```javascript
// === Free Game 开始 ===
remainingSpins = 10;
// 累积变量在整个Free Game期间保留
wild_eliminate_count = 0;
mega_level = 0;
mega_eliminate_count = 0;

// --- Spin 1 ---
// ... 游戏流程 ...
// 结束时: wild_eliminate_count=3, mega_level=1, mega_eliminate_count=0

checkRetrigger();  // 3個C1 → +10 spins
remainingSpins = 9 + 10 = 19;

// --- Spin 2 (保留累积状态！) ---
// 开始时: wild_eliminate_count=3, mega_level=1  ← 保留！
// ... 游戏流程 ...
// 结束时: wild_eliminate_count=6, mega_level=0, mega_eliminate_count=1

// --- Spin 3 ---
// 开始时: wild_eliminate_count=6, mega_level=0, mega_eliminate_count=1  ← 继续累积
// ...

// Free Game 结束后，所有累积重置
```

---

## HTML Demo 开发指南

### 1. 文件结构
```
/demo/
  ├── index.html          # 主页面
  ├── data.js             # 游戏数据（从主目录复制）
  ├── game-engine.js      # 游戏引擎
  ├── visualization.js    # 可视化渲染
  └── styles.css          # 样式
```

### 2. 核心功能模块

#### game-engine.js
```javascript
class GameEngine {
    constructor(data) {
        this.data = data;
        this.board = [];
        this.wildEliminateCount = 0;
        this.megaLevel = 0;
        this.megaEliminateCount = 0;
    }
    
    // 权重选择
    weightedChoice(weights) {
        const total = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
            if (rand < weights[i]) return i;
            rand -= weights[i];
        }
        return weights.length - 1;
    }
    
    // 初始化盘面
    initializeBoard(isFreeGame = false) {
        const reelWeight = isFreeGame ? 
            this.data.FreeReelWeight : this.data.ReelWeight;
        const reelSet = this.weightedChoice(reelWeight) + 1;
        
        // ... 生成盘面逻辑
        this.board[3][6] = 0; // Wild
    }
    
    // BFS查找连通符号
    bfsFindConnected(startRow, startCol, visited) {
        // ... 六角网格BFS实现
    }
    
    // 查找所有匹配
    findAllMatches() {
        // ... 返回所有符号组
    }
    
    // 处理消除和计分
    processMatches(matches) {
        let totalScore = 0;
        let wildGroupCount = 0;
        
        for (const match of matches) {
            const containsWild = this.checkWildInGroup(match.positions);
            const baseScore = this.getBaseScore(match.symbol, match.count);
            
            let finalScore;
            if (containsWild) {
                wildGroupCount++;
                const wildMult = this.getWildMultiplier(this.wildEliminateCount);
                finalScore = baseScore * wildMult;
            } else {
                finalScore = baseScore;
            }
            
            totalScore += finalScore;
            this.clearSymbols(match.positions);
        }
        
        // 更新Wild计数
        if (wildGroupCount > 0) {
            this.wildEliminateCount++;
            this.updateMegaLevel(wildGroupCount);
        }
        
        return { totalScore, wildGroupCount };
    }
    
    // 更新Mega等级
    updateMegaLevel(wildGroupCount) {
        if (this.megaEliminateCount < 3) {
            const increase = Math.min(wildGroupCount, 2);
            this.megaLevel = Math.min(this.megaLevel + increase, 2);
            
            if (this.megaLevel === 2) {
                this.megaEliminateCount++;
                this.megaLevel = 0;
            }
        }
    }
    
    // 执行一轮游戏
    playRound(keepMultipliers = false) {
        if (!keepMultipliers) {
            this.wildEliminateCount = 0;
            this.megaLevel = 0;
            this.megaEliminateCount = 0;
        }
        
        let cascadeCount = 0;
        let totalScore = 0;
        
        while (true) {
            const matches = this.findAllMatches();
            
            if (matches.length === 0) {
                if (this.megaEliminateCount > 0) {
                    this.placeMegaSymbols();
                    continue;
                }
                break;
            }
            
            const result = this.processMatches(matches);
            totalScore += result.totalScore;
            cascadeCount++;
            
            this.dropSymbols();
            this.fillEmpty();
        }
        
        return { cascadeCount, totalScore };
    }
}
```

#### visualization.js
```javascript
class GameVisualization {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.hexRadius = 40;
    }
    
    // 绘制六角网格
    drawHexGrid(board) {
        const hexHeight = this.hexRadius * Math.sqrt(3);
        const hexWidth = this.hexRadius * 2;
        
        for (let row = 0; row < 7; row++) {
            const rowSize = this.getRowSize(row);
            const cols = this.getRowCols(row);
            
            for (let i = 0; i < rowSize; i++) {
                const col = cols[i];
                const x = col * (hexWidth * 0.75);
                const y = row * hexHeight;
                
                const symbol = board[row][col];
                this.drawHexagon(x, y, symbol);
            }
        }
    }
    
    // 绘制单个六角形
    drawHexagon(x, y, symbol) {
        // ... 六角形绘制逻辑
        // 显示符号内容
    }
    
    // 高亮消除符号
    highlightMatches(matches) {
        // ... 动画效果
    }
    
    // 显示分数
    showScore(score, x, y) {
        // ... 分数弹出动画
    }
}
```

### 3. HTML 结构示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>瘋狂果醬罐 Demo</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="game-container">
        <div class="info-panel">
            <h2>游戏信息</h2>
            <div id="wild-multiplier">Wild倍数: 1</div>
            <div id="mega-level">Mega等级: 0</div>
            <div id="mega-count">Mega计数: 0</div>
            <div id="total-score">总分: 0</div>
        </div>
        
        <canvas id="game-canvas"></canvas>
        
        <div class="controls">
            <button id="btn-spin">旋转</button>
            <button id="btn-auto">自动游戏</button>
            <button id="btn-reset">重置</button>
            <select id="game-mode">
                <option value="base">Base Game</option>
                <option value="free">Free Game</option>
            </select>
        </div>
        
        <div class="log-panel">
            <h3>游戏日志</h3>
            <div id="game-log"></div>
        </div>
    </div>
    
    <script src="data.js"></script>
    <script src="game-engine.js"></script>
    <script src="visualization.js"></script>
    <script>
        const engine = new GameEngine(data);
        const viz = new GameVisualization('game-canvas');
        
        document.getElementById('btn-spin').onclick = () => {
            engine.initializeBoard();
            viz.drawHexGrid(engine.board);
            
            const result = engine.playRound();
            console.log('Cascade:', result.cascadeCount);
            console.log('Score:', result.totalScore);
        };
    </script>
</body>
</html>
```

### 4. 关键实现要点

#### 六角坐标转换
```javascript
function getRowCols(row) {
    const colMap = {
        0: [3, 5, 7, 9],
        1: [2, 4, 6, 8, 10],
        2: [1, 3, 5, 7, 9, 11],
        3: [0, 2, 4, 6, 8, 10, 12],
        4: [1, 3, 5, 7, 9, 11],
        5: [2, 4, 6, 8, 10],
        6: [3, 5, 7, 9]
    };
    return colMap[row];
}

function getHexNeighbors(row, col) {
    // 根据行的奇偶性返回6个邻居坐标
    // ... 实现逻辑
}
```

#### 动画系统
```javascript
class AnimationController {
    async animateCascade(matches) {
        // 1. 高亮匹配符号
        await this.highlight(matches);
        
        // 2. 消除动画
        await this.disappear(matches);
        
        // 3. 下落动画
        await this.drop();
        
        // 4. 填充动画
        await this.fill();
    }
}
```

### 5. 调试工具

```javascript
// 日志输出
function logCascade(cascadeNum, matches, score) {
    const log = `
        Cascade ${cascadeNum}:
        - 匹配组数: ${matches.length}
        - 总分: ${score}
        - Wild倍数: ${getWildMultiplier(wildEliminateCount)}
        - Mega状态: ${megaLevel}/${megaEliminateCount}
    `;
    document.getElementById('game-log').innerHTML += log;
}

// 盘面状态导出
function exportBoardState() {
    return JSON.stringify({
        board: board,
        wildCount: wildEliminateCount,
        megaLevel: megaLevel,
        megaCount: megaEliminateCount
    });
}
```

---

## 附录：快速参考

### 符号ID对应

完整的符号编号对应表（0-11）：

| ID | 符号名称 | 类型 | 说明 |
|----|---------|------|------|
| 0  | Wild    | 特殊符号 | 万能符号，固定在[3,6]位置，不被消除 |
| 1  | C1      | 特殊符号 | 每行最多1个，触发Retrigger（Free Game） |
| 2  | M1      | 普通符号 | 可消除的普通符号 |
| 3  | M2      | 普通符号 | 可消除的普通符号 |
| 4  | M3      | 普通符号 | 可消除的普通符号 |
| 5  | M4      | 普通符号 | 可消除的普通符号 |
| 6  | M5      | 普通符号 | 可消除的普通符号 |
| 7  | M6      | 普通符号 | 可消除的普通符号 |
| 8  | M7      | 普通符号 | 可消除的普通符号 |
| 9  | MY1     | MY符号 | 初始化后会转换为M1-M7 |
| 10 | MY2     | MY符号 | 初始化后会转换为M1-M7 |
| 11 | MY3     | MY符号 | 初始化后会转换为M1-M7 |

**注意事项**：
- **Wild (0)**：永久固定，参与消除但不被清除
- **C1 (1)**：不能被Mega符号覆盖
- **M1-M7 (2-8)**：参与消除和计分的主要符号
- **MY1-MY3 (9-11)**：辅助符号，在盘面初始化完成后会根据MY权重转换为M1-M7之一

### 关键数值
- 最小消除数：6个相连
- Wild倍数上限：1000
- Mega等级范围：0-2
- Mega计数上限：3
- 钻石形状：4格

### 重要坐标
- Wild位置：[3, 6]
- 六角网格：共37格
- Mega中心点：24个可选位置

---

**文档版本**: 1.0  
**最后更新**: 2026-04-10
