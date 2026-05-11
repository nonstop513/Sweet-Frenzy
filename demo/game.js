// ============================================
// 🚀 图片预加载系统（性能优化）
// ============================================

// 图片预加载缓存
const imageCache = {};
let imagesPreloaded = false;

// 快速模式配置（可选）
const FAST_MODE = false;  // 设为 true 启用快速模式

// ✅ 动画速度倍数（1x = 普通, 3x = 快速）
let SPEED_MULTIPLIER = 1;

const ANIMATION_DELAYS_BASE = FAST_MODE ? {
    gravity: 400,        // Gravity 动画（原 1180ms）
    eliminate: 300,      // 消除提示（原 1000ms）
    cascade: 300,        // Cascade 提示（原 1000ms）
    mega: 500,          // Mega 放置（原 1000ms）
    retrigger: 800,     // Retrigger 提示（原 2000ms）
    message: 300,       // 一般提示（原 500-800ms）
    fill: 300,          // Fill 动画（原 650ms）
    initialDrop: 400,   // 初始下落CSS动画时间（原 700ms）
    rowDelay: 50        // 每列延迟时间（原 80ms）
} : {
    gravity: 1180,
    eliminate: 1000,
    cascade: 1000,
    mega: 1000,
    retrigger: 2000,
    message: 800,
    fill: 650,
    initialDrop: 700,   // 初始下落CSS动画时间
    rowDelay: 80        // 每列延迟时间
};

// ✅ 获取当前速度的延迟时间
function getDelay(type) {
    return Math.max(50, ANIMATION_DELAYS_BASE[type] / SPEED_MULTIPLIER);
}

// ✅ 切换动画速度
function toggleSpeed() {
    if (SPEED_MULTIPLIER === 1) {
        SPEED_MULTIPLIER = 3;
        console.log('⚡ 动画速度: 3x');
    } else {
        SPEED_MULTIPLIER = 1;
        console.log('🐢 动画速度: 1x');
    }
    updateSpeedButton();
}

// ✅ 更新速度按钮显示
function updateSpeedButton() {
    const speedBtn = document.getElementById('speedToggleBtn');
    if (speedBtn) {
        if (SPEED_MULTIPLIER === 1) {
            speedBtn.textContent = '动画速度: 1x';
            speedBtn.classList.remove('speed-fast');
        } else {
            speedBtn.textContent = '动画速度: 3x ⚡';
            speedBtn.classList.add('speed-fast');
        }
    }
}

// 预加载所有图片
async function preloadImages() {
    if (imagesPreloaded) return;
    
    console.log('🎨 开始预加载图片...');
    const startTime = performance.now();
    
    const symbolNames = ['WW', 'C1', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'];
    
    const promises = symbolNames.map(name => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                imageCache[name] = img;
                console.log(`  ✅ 加载: ${name}.png`);
                resolve();
            };
            img.onerror = () => {
                console.warn(`  ⚠️ 加载失败: ${name}.png`);
                resolve(); // 即使失败也继续
            };
            img.src = `img/${name}.png`;
        });
    });
    
    await Promise.all(promises);
    
    const duration = performance.now() - startTime;
    console.log(`✅ 图片预加载完成！耗时: ${duration.toFixed(0)}ms`);
    console.log(`📦 已缓存 ${Object.keys(imageCache).length} 张图片`);
    
    imagesPreloaded = true;
}

// ============================================
// 遊戲狀態
// ============================================
const BET = 100;  // 下注金額

const gameState = {
    grid: [],
    rowSizes: [4, 5, 6, 7, 6, 5, 4],
    totalScore: 0,
    wildEliminateCount: 0,
    megaLevel: 0,
    megaEliminateCount: 0,
    eliminateCount: 0,
    selectedCells: new Set(),
    isAnimating: false,
    currentScript: null,  // 當前執行的腳本
    engine: null,         // 遊戲引擎實例
    // FreeGame 狀態
    isFreeGame: false,    // 是否在 FreeGame 中
    freeGameScript: null, // FreeGame 完整腳本
    freeGameSpinIndex: 0, // 當前執行到第幾個 spin
    freeGameTotalScore: 0, // FreeGame 總分
    freeGameRemainingSpins: 0, // 剩餘 spin 數
    baseGameWildCount: 0,  // BaseGame 結束時的 Wild 倍數（用於繼承）
    buyFeaturePending: false,  // Buy Feature 版面待觸發
    // Auto Spin 狀態
    isAutoSpin: false,    // 是否正在自動旋轉
    autoSpinCount: 0,     // 自動旋轉計數
    // ✅ 金額與統計
    balance: 100000,      // 當前金額
    totalSpinCount: 0,    // 總Spin次數
    totalBet: 0,          // 總投注額
    totalWin: 0,          // 總贏得金額
    hitsCount: 0          // Hits次數（分數>0的次數）
};

// 符號映射
const symbolMap = {
    0: { name: 'WILD', img: 'img/WW.png' },
    1: { name: 'C1', img: 'img/C1.png' },
    2: { name: 'M1', img: 'img/M1.png' },
    3: { name: 'M2', img: 'img/M2.png' },
    4: { name: 'M3', img: 'img/M3.png' },
    5: { name: 'M4', img: 'img/M4.png' },
    6: { name: 'M5', img: 'img/M5.png' },
    7: { name: 'M6', img: 'img/M6.png' },
    8: { name: 'M7', img: 'img/M7.png' },
    9: { name: 'MY1', img: 'img/M1.png' },   // MY符號（應該被轉換）
    10: { name: 'MY2', img: 'img/M2.png' },  // MY符號（應該被轉換）
    11: { name: 'MY3', img: 'img/M3.png' }   // MY符號（應該被轉換）
};

// 坐標系統 - 實際列坐標
const rowColMapping = [
    [3, 5, 7, 9],              // Row 0: 4個
    [2, 4, 6, 8, 10],          // Row 1: 5個
    [1, 3, 5, 7, 9, 11],       // Row 2: 6個
    [0, 2, 4, 6, 8, 10, 12],   // Row 3: 7個 (Wild在index 3)
    [1, 3, 5, 7, 9, 11],       // Row 4: 6個
    [2, 4, 6, 8, 10],          // Row 5: 5個
    [3, 5, 7, 9]               // Row 6: 4個
];

// =============== 初始化 ===============

// 初始化遊戲
async function initGame() {
    console.log('🎮 初始化游戏...');
    
    // 1. ✅ 先预加载图片
    await preloadImages();
    
    // 2. 創建遊戲引擎
    gameState.engine = new GameEngine(data);
    
    // 3. 创建网格和事件监听
    createGrid();
    updateUI();
    attachEventListeners();
    
    // 4. ✅ 初始化背景為 BaseGame
    const boardContainer = document.getElementById('boardContainer');
    boardContainer.classList.add('base-game');
    
    // 5. ✅ 初始化 Auto Spin 按鈕狀態
    updateAutoSpinButtons();

    // 6. ✅ 初始化速度按钮状态
    updateSpeedButton();

    // 7. ✅ 初始化 Grid 縮放並監聽視窗大小變化
    scaleHexGrid();
    window.addEventListener('resize', scaleHexGrid);

    console.log('✅ 游戏初始化完成！');
    
    if (FAST_MODE) {
        console.log('⚡ 快速模式已启用');
    }
}

// 創建網格
function createGrid() {
    const hexGrid = document.getElementById('hexGrid');
    hexGrid.innerHTML = '';
    gameState.grid = [];
    
    // 每個row的區域座標（根據board.jpg調整）
    const rowBounds = [
        { x1: 7, y1: 102,  x2: 92, y2: 490 },   // Row 0: 4個 (左上)
        { x1: 90,  y1: 52,  x2: 175, y2: 540 },   // Row 1: 5個
        { x1: 173,  y1: 2,  x2: 258, y2: 590 },   // Row 2: 6個
        { x1: 256,  y1: -48,  x2: 341,  y2: 630 },   // Row 3: 7個 (中央，含Wild)
        { x1: 339,  y1: 2,  x2: 424, y2: 590 },   // Row 4: 6個
        { x1: 422,  y1: 52,  x2: 507, y2: 540 },   // Row 5: 5個
        { x1: 505, y1: 102, x2: 590, y2: 490 }    // Row 6: 4個 (右下)
    ];
    
    // 創建7個垂直reel（row0~row6）
    for (let row = 0; row < gameState.rowSizes.length; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'hex-row';
        rowDiv.dataset.row = row;
        
        const bounds = rowBounds[row];
        const rowWidth = bounds.x2 - bounds.x1;
        const rowHeight = bounds.y2 - bounds.y1;
        
        // 設定此row的區域位置和大小
        rowDiv.style.left = `${bounds.x1}px`;
        rowDiv.style.top = `${bounds.y1}px`;
        rowDiv.style.width = `${rowWidth}px`;
        rowDiv.style.height = `${rowHeight}px`;
        
        const rowData = [];
        const rowSize = gameState.rowSizes[row];
        
        // 【重要】反向创建格子，使得col=0在底部，col=max在顶部
        // 从高索引到低索引添加到DOM，但数据数组按正常顺序
        for (let col = rowSize - 1; col >= 0; col--) {
            const cell = document.createElement('div');
            cell.className = 'hex-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            // 中央Wild固定位置 [3,3] -> row=3, col=3
            const isWild = (row === 3 && col === 3);
            if (isWild) {
                cell.classList.add('wild');
            }
            
            rowDiv.appendChild(cell);
        }
        
        // 数据数组按正常顺序(col=0,1,2,3)创建，与DOM元素对应
        for (let col = 0; col < rowSize; col++) {
            const isWild = (row === 3 && col === 3);
            const cellElement = rowDiv.children[rowSize - 1 - col]; // 反向索引获取对应的DOM元素
            
            const cellData = {
                row: row,
                col: col,
                realCol: rowColMapping[row][col],
                symbol: isWild ? 0 : null,
                element: cellElement
            };
            rowData.push(cellData);
            
            // 如果是Wild，立即顯示圖片
            if (isWild) {
                updateCellDisplay(cellData);
            }
        }
        
        hexGrid.appendChild(rowDiv);
        gameState.grid.push(rowData);
    }
}

// =============== 動畫函數 ===============

// 初始下落動畫：整列符號作為整體從上方掉落
async function renderInitialDropAnimation() {
    for (let row = 0; row < gameState.grid.length; row++) {
        const cellsInReel = gameState.grid[row];
        const reelSize = cellsInReel.length;
        
        // 整列起始位置（所有符號的高度總和）
        const startTop = -87 * reelSize; // 82px高度 + 5px間隔
        
        // 更新符號圖片並設置初始位置
        cellsInReel.forEach(cell => {
            if (cell.symbol === 0) return; // 跳過Wild
            
            updateCellDisplay(cell);
            const img = cell.element.querySelector('img');
            if (img) {
                img.style.position = 'relative';
                img.style.top = `${startTop}px`;
                img.style.opacity = '1';
                img.style.transition = 'none';
            }
        });
        
        // 延遲啟動動畫，創造波浪效果
        const delay = row * (ANIMATION_DELAYS_BASE.rowDelay / SPEED_MULTIPLIER); // 動態計算延遲
        
        setTimeout(() => {
            requestAnimationFrame(() => {
                cellsInReel.forEach(cell => {
                    if (cell.symbol === 0) return;
                    const img = cell.element.querySelector('img');
                    if (img) {
                        const transitionTime = (ANIMATION_DELAYS_BASE.initialDrop / SPEED_MULTIPLIER) / 1000; // 轉換為秒
                        img.style.transition = `top ${transitionTime}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
                    }
                });
                requestAnimationFrame(() => {
                    cellsInReel.forEach(cell => {
                        if (cell.symbol === 0) return;
                        const img = cell.element.querySelector('img');
                        if (img) {
                            img.style.top = '0px';
                        }
                    });
                });
            });
        }, delay);
    }
    
    // 等待所有動畫完成（最後一列的延遲 + 動畫時間）
    // ⚡ 使用配置值（快速模式：400ms / 普通模式：1180ms）
    await sleep(getDelay('gravity'));
    
    // 清理樣式
    document.querySelectorAll('.hex-cell img').forEach(img => {
        img.style.position = '';
        img.style.top = '';
        img.style.transition = '';
    });
}

// 重力動畫渲染
async function renderBoardWithGravity(oldPositions) {
    // 處理每個reel
    for (let row = 0; row < gameState.grid.length; row++) {
        const cellsInReel = gameState.grid[row];
        
        // 為每個符號查找原位置並設置初始動畫狀態
        for (let col = 0; col < cellsInReel.length; col++) {
            const cell = cellsInReel[col];
            
            // 跳過Wild（Wild固定不動）
            if (row === 3 && col === 3) {
                // 確保Wild圖片顯示
                if (cell.symbol === 0 && !cell.element.querySelector('img')) {
                    updateCellDisplay(cell);
                }
                continue;
            }
            
            // 跳過null
            if (cell.symbol === null) {
                cell.element.innerHTML = '';
                continue;
            }
            
            // 查找這個符號原來的位置（查找整行）
            let oldCol = -1;
            for (let c = 0; c < cellsInReel.length; c++) {
                if (oldPositions[row][c] === cell.symbol) {
                    oldCol = c;
                    oldPositions[row][c] = -999; // 標記已使用
                    break;
                }
            }
            
            updateCellDisplay(cell);
            const img = cell.element.querySelector('img');
            if (!img) continue;
            
            if (oldCol === -1) {
                // 新符號：從上方掉落（col=3以上的虛擬位置）
                const dropDistance = cellsInReel.length * 87 + 100; // 從整列高度之上
                img.style.position = 'relative';
                img.style.top = `${-dropDistance}px`;
                img.style.opacity = '0';
                img.style.transition = 'none';
            } else if (oldCol !== col) {
                // 移動符號：從原位置移動到新位置
                // 注意：新DOM中col=0在底部，col=3在頂部
                // 從高col到低col是從上往下移動
                const distance = (col - oldCol) * 87;
                img.style.position = 'relative';
                img.style.top = `${distance}px`;
                img.style.opacity = '1';
                img.style.transition = 'none';
            }
        }
    }
    
    // 等待一幀
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 啟用transition
    document.querySelectorAll('.hex-cell img').forEach(img => {
        img.style.transition = 'top 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s';
    });
    
    // 再等一幀後觸發動畫
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // 觸發移動到最終位置
    document.querySelectorAll('.hex-cell img').forEach(img => {
        img.style.top = '0px';
        img.style.opacity = '1';
    });
    
    // 等待動畫完成
    await sleep(getDelay('fill'));
    
    // 清理樣式
    document.querySelectorAll('.hex-cell img').forEach(img => {
        img.style.position = '';
        img.style.top = '';
        img.style.transition = '';
    });
}

// =============== 顯示函數 ===============

// 更新單元格顯示（✅ 使用预加载优化）
function updateCellDisplay(cell) {
    const symbolData = symbolMap[cell.symbol];
    if (!symbolData) return;
    
    cell.element.innerHTML = '';
    
    // ✅ 优先使用预加载的图片
    const cachedImg = imageCache[symbolData.name];
    
    if (cachedImg) {
        // 复用预加载的图片（克隆节点）
        const img = cachedImg.cloneNode(false);
        img.alt = symbolData.name;
        cell.element.appendChild(img);
    } else {
        // 回退方案：传统加载
        const img = document.createElement('img');
        img.src = symbolData.img;
        img.alt = symbolData.name;
        img.onerror = function() {
            // 如果圖片加載失敗，顯示文字
            this.style.display = 'none';
            const text = document.createElement('div');
            text.textContent = symbolData.name;
            text.style.fontSize = '12px';
            text.style.fontWeight = 'bold';
            text.style.color = '#333';
            cell.element.appendChild(text);
        };
        cell.element.appendChild(img);
    }
    
    // 顯示坐標（直接使用board索引，不反轉）- 已隱藏
    const idLabel = document.createElement('div');
    idLabel.className = 'symbol-id';
    idLabel.style.display = 'none'; // 隱藏坐標顯示
    
    // 為mega符號添加特殊背景色
    if (cell.element.classList.contains('mega-appear')) {
        idLabel.style.backgroundColor = 'yellow';
        idLabel.style.fontWeight = 'bold';
        idLabel.textContent = `★[${cell.row},${cell.col}]`;
    } else {
        idLabel.textContent = `[${cell.row},${cell.col}]`;
    }
    
    cell.element.appendChild(idLabel);
}

// =============== BFS鄰居檢測（調試用） ===============

// 獲取六方向鄰居
function getNeighbors(row, col) {
    const neighbors = [];
    const realCol = rowColMapping[row][col];
    
    // 六角網格的六個方向（匹配simulation_numba.py）
    const directions = [
        { dr: -1, dc: -1 }, // 上左
        { dr: -1, dc: +1 }, // 上右
        { dr: 0, dc: -2 },  // 左
        { dr: 0, dc: +2 },  // 右
        { dr: +1, dc: -1 }, // 下左
        { dr: +1, dc: +1 }  // 下右
    ];
    
    for (const dir of directions) {
        const newRow = row + dir.dr;
        const newRealCol = realCol + dir.dc;
        
        // 檢查新行是否有效
        if (newRow < 0 || newRow >= gameState.grid.length) continue;
        
        // 在新行中查找對應的列
        const rowData = gameState.grid[newRow];
        for (let i = 0; i < rowData.length; i++) {
            if (rowData[i].realCol === newRealCol) {
                neighbors.push({ row: newRow, col: i });
                break;
            }
        }
    }
    
    return neighbors;
}

// BFS查找相連符號組（調試用）
function findConnectedGroup(startRow, startCol) {
    const cell = gameState.grid[startRow][startCol];
    if (!cell || cell.symbol === null || cell.symbol === 0) return []; // 不從Wild開始查找
    
    const targetSymbol = cell.symbol;
    const visited = new Set();
    const wildInQueue = new Set(); // 追蹤Wild是否在當前BFS中
    const queue = [{ row: startRow, col: startCol }];
    const group = [];
    
    visited.add(`${startRow},${startCol}`);
    
    while (queue.length > 0) {
        const current = queue.shift();
        group.push(current);
        
        const neighbors = getNeighbors(current.row, current.col);
        
        for (const neighbor of neighbors) {
            const neighborCell = gameState.grid[neighbor.row][neighbor.col];
            if (!neighborCell || neighborCell.symbol === null) continue;
            
            const key = `${neighbor.row},${neighbor.col}`;
            
            // 處理相同符號
            if (neighborCell.symbol === targetSymbol) {
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(neighbor);
                }
            }
            // 處理Wild符號（Wild不標記visited，可以被多個組使用）
            else if (neighborCell.symbol === 0) {
                if (!wildInQueue.has(key)) {
                    wildInQueue.add(key);
                    queue.push(neighbor);
                }
            }
        }
    }
    
    return group;
}

// =============== 腳本驅動的Spin系統 ===============

// Spin按鈕 - 腳本驅動架構
async function onSpin() {
    if (gameState.isAnimating) return;
    
    gameState.isAnimating = true;
    
    // 檢查是否是Buy Feature待觸發狀態
    if (gameState.buyFeaturePending) {
        logDebug('=== 檢查Buy Feature版面觸發 ===');
        gameState.buyFeaturePending = false;
        // 直接檢查並觸發FreeGame（currentScript.initialBoard已經是Buy Feature版面）
        await checkAndTriggerFreeGame();
        return;
    }
    
    // 檢查是否在FreeGame中
    if (gameState.isFreeGame) {
        await playNextFreeGameSpin();
        return;
    }
    
    // ✅ BaseGame: 扣除100金額，統計Spin數
    if (gameState.balance >= 100) {
        gameState.balance -= 100;
        gameState.totalBet += 100;
        gameState.totalSpinCount++;
    } else {
        console.warn('⚠️ 金額不足！');
        gameState.isAnimating = false;
        updateUI();
        return;
    }
    
    logDebug('=== 新遊戲開始 ===');
    logDebug(`【Spin開始前】gameState.megaLevel = ${gameState.megaLevel}, gameState.megaEliminateCount = ${gameState.megaEliminateCount}`);
    
    // ========== 第一階段：生成完整腳本 ==========
    // 重要：每次Spin時megaLevel從0開始，只有megaEliminateCount跨Spin累積
    const spinStartMegaLevel = 0; // 每次Spin都從0開始
    const spinStartMegaCount = gameState.megaEliminateCount; // 累積值
    
    // console.log(`%c【重要】本次Spin起始參數: megaLevel=${spinStartMegaLevel}(固定), megaEliminateCount=${spinStartMegaCount}(累積)`, 'color: blue; font-weight: bold');
    
    gameState.currentScript = gameState.engine.generateSpinScript(
        spinStartMegaLevel,
        spinStartMegaCount,
        false,  // isFreeGame
        0,      // startWildCount
        BET     // bet = 100
    );
    
    logDebug(`腳本生成完成: Reel Set ${gameState.currentScript.reelSet}`);
    
    // ✅ 顯示重抽次數
    if (gameState.currentScript.redrawAttempts > 1) {
        console.log(`🔄 BaseGame 重抽: ${gameState.currentScript.redrawAttempts} 次`);
    } else {
        console.log(`✅ BaseGame 重抽: 無需重抽 (1次生成)`);
    }
    
    // 顯示Reel配置詳情
    if (gameState.currentScript.reelInfo && gameState.currentScript.reelInfo.length > 0) {
        const reelInfoStr = gameState.currentScript.reelInfo
            .map((info, row) => `Row${row}(Set${info.reelSet},Pos${info.startIdx}/${info.reelLen})`)
            .join(', ');
        logDebug(`初始Reel配置: ${reelInfoStr}`);
    }
    
    logDebug(`預計總分: ${gameState.currentScript.totalScore}`);
    logDebug(`總Cascade: ${gameState.currentScript.cascades.length}次`);
    logDebug(`腳本最終Mega狀態: Level=${gameState.currentScript.megaLevel}, Count=${gameState.currentScript.megaEliminateCount}`);
    
    // 重置狀態
    // 注意：megaLevel和megaEliminateCount由cascade更新，這裡不重置
    gameState.totalScore = 0;
    gameState.wildEliminateCount = 0;
    gameState.eliminateCount = 0;
    
    // ========== 第二階段：執行表演 ==========
    
    // 1. 顯示初始盤面
    await performInitialBoard(gameState.currentScript.initialBoard);
    
    // 2. 執行所有cascade
    for (const cascade of gameState.currentScript.cascades) {
        await performCascade(cascade);
        logDebug(`執行Cascade #${cascade.index}後，gameState Mega: Level=${gameState.megaLevel}, Count=${gameState.megaEliminateCount}`);
    }
    
    // 3. 確保mega狀態與腳本的最終狀態一致
    // （注意：每個cascade都已經更新了gameState，但為了保險起見再同步一次）
    const finalMegaLevel = gameState.currentScript.megaLevel;
    const finalMegaCount = gameState.currentScript.megaEliminateCount;
    
    if (gameState.megaLevel !== finalMegaLevel || gameState.megaEliminateCount !== finalMegaCount) {
        logDebug(`警告：gameState與script的Mega狀態不一致！`);
        logDebug(`  gameState: Level=${gameState.megaLevel}, Count=${gameState.megaEliminateCount}`);
        logDebug(`  script: Level=${finalMegaLevel}, Count=${finalMegaCount}`);
        logDebug(`  使用script的值更新gameState`);
        gameState.megaLevel = finalMegaLevel;
        gameState.megaEliminateCount = finalMegaCount;
        updateUI();
    }
    
    logDebug(`===  遊戲結束 ===`);
    // 只顯示分數（由engine.js的console.log輸出）
    logDebug(`最終分數: ${gameState.totalScore}`);
    logDebug(`本次Spin結束時Mega狀態: Level=${gameState.megaLevel} (僅本次Spin有效), Count=${gameState.megaEliminateCount} (累積)`);
    
    // ✅ 統計Hits（分數>0）和贏得金額
    if (gameState.totalScore > 0) {
        gameState.hitsCount++;
        gameState.totalWin += gameState.totalScore;
        gameState.balance += gameState.totalScore;
    }
    
    gameState.isAnimating = false;
    updateUI();
    
    // 檢查是否觸發FreeGame
    if (!gameState.isFreeGame) {
        await checkAndTriggerFreeGame();
    }
}

// 檢查並觸發FreeGame
async function checkAndTriggerFreeGame() {
    gameState.isAnimating = true;  // 防止在FreeGame啟動期間再次點擊
    
    // 獲取最終盤面（最後一個cascade的fill後或mega後盤面）
    let finalBoard = gameState.currentScript.initialBoard;
    if (gameState.currentScript.cascades && gameState.currentScript.cascades.length > 0) {
        const lastCascade = gameState.currentScript.cascades[gameState.currentScript.cascades.length - 1];
        if (lastCascade.boardAfterFill) {
            finalBoard = lastCascade.boardAfterFill;
        } else if (lastCascade.boardAfterMega) {
            finalBoard = lastCascade.boardAfterMega;
        } else {
            console.warn('警告：lastCascade 沒有 boardAfterFill 或 boardAfterMega，使用 initialBoard');
        }
    }
    
    const retrigger = gameState.engine.checkRetrigger(finalBoard);
    
    if (retrigger.triggered) {
        logDebug(`\n🎰 觸發FreeGame！C1數量: ${retrigger.c1Count}, 獲得 ${retrigger.extraSpins} 次FreeGame`);
        // ⚡ Retrigger延迟已移除，立即进入FreeGame
        // await sleep(ANIMATION_DELAYS.retrigger);
        // 開始FreeGame
        await startFreeGame(retrigger.extraSpins);
    } else {
        // 沒有觸發，恢復可點擊狀態
        gameState.isAnimating = false;
    }
}

// 開始FreeGame
async function startFreeGame(initialSpins) {
    gameState.isFreeGame = true;
    gameState.freeGameTotalScore = 0;
    gameState.baseGameWildCount = gameState.wildEliminateCount;  // 保存BaseGame的Wild倍數
    
    logDebug(`\n========== FreeGame 開始 ==========`);
    logDebug(`初始次數: ${initialSpins}`);
    logDebug(`起始Wild倍數: 0 (從1開始重新累積)`);
    
    // 生成完整的FreeGame腳本
    gameState.freeGameScript = gameState.engine.generateFreeGameScript(initialSpins, 0, BET);
    gameState.freeGameSpinIndex = 0;
    
    // ✅ 顯示整場FreeGame的重抽次數
    const fgRedrawAttempts = gameState.freeGameScript.redrawAttempts || 1;
    const totalSpins = gameState.freeGameScript.spins.length;
    const totalScore = gameState.freeGameScript.totalScore;
    
    console.log(`\n📊 FreeGame 重抽統計:`);
    if (fgRedrawAttempts > 1) {
        console.log(`   🔄 整場FreeGame重抽: ${fgRedrawAttempts} 次`);
        console.log(`   🎯 最終採用: 第${fgRedrawAttempts}次生成`);
    } else {
        console.log(`   ✅ 整場FreeGame重抽: 無需重抽 (1次生成)`);
    }
    console.log(`   🎰 總Spin數: ${totalSpins}`);
    console.log(`   💰 總得分: ${totalScore}`);
    console.log(`   📊 平均倍數: ${(totalScore / totalSpins).toFixed(2)}x/spin`);
    
    updateUIShowFreeGame();
    
    gameState.isAnimating = false;  // 允許手動按spin
    
    logDebug('✨ 請按Spin或空白鍵開始FreeGame！');
}

// 執行下一個FreeGame Spin
async function playNextFreeGameSpin() {
    if (gameState.freeGameSpinIndex >= gameState.freeGameScript.spins.length) {
        // 所有spin已完成，結束FreeGame
        await endFreeGame();
        return;
    }
    
    const spinScript = gameState.freeGameScript.spins[gameState.freeGameSpinIndex];
    
    logDebug(`\n--- FreeGame Spin ${gameState.freeGameSpinIndex + 1}/${gameState.freeGameScript.spins.length} ---`);
    
    // ✅ FreeGame各Spin不再顯示重抽（只有整場重抽）
    
    // 執行這個spin
    await playFreeGameSpin(spinScript);
    
    // 移動到下一個spin
    gameState.freeGameSpinIndex++;
    
    updateUIShowFreeGame();
    
    // 檢查是否還有剩餘spin
    if (gameState.freeGameSpinIndex >= gameState.freeGameScript.spins.length) {
        // 所有spin已完成
        await sleep(getDelay('message'));
        await endFreeGame();
    } else {
        // 還有spin，恢復可點擊狀態，等待下一次手動spin
        gameState.isAnimating = false;
        logDebug(`✨ 剩餘 ${gameState.freeGameScript.spins.length - gameState.freeGameSpinIndex} 次spin，請按Spin或空白鍵繼續！`);
    }
}

// 表演FreeGame的單次spin
async function playFreeGameSpin(spinScript) {
    gameState.currentScript = spinScript;
    
    // 【重要】設置此spin開始時的wildCount（FreeGame中累積）
    if (spinScript.startWildCount !== undefined) {
        gameState.wildEliminateCount = spinScript.startWildCount;
        updateUI();  // 立即更新UI顯示正確的倍數
        logDebug(`FreeGame Spin開始 - Wild倍數: ${getWildMultiplier(spinScript.startWildCount)}x (wildCount=${spinScript.startWildCount})`);
    }
    
    // 1. 顯示初始盤面
    await performInitialBoard(spinScript.initialBoard);
    
    // 2. 執行所有cascade
    for (const cascade of spinScript.cascades) {
        await performCascade(cascade);
    }
    
    // 3. 檢查Retrigger
    if (spinScript.retrigger && spinScript.retrigger.triggered) {
        logDebug(`✨ Retrigger! 獲得額外 ${spinScript.retrigger.extraSpins} 次spin`);
        // 更新總spin數顯示
        updateUIShowFreeGame();
        await sleep(getDelay('message'));
    }
    
    // Spin結束後記錄最終wildCount
    logDebug(`FreeGame Spin結束 - Wild倍數: ${getWildMultiplier(spinScript.endWildCount)}x (wildCount=${spinScript.endWildCount})`);
    
    // ✅ 統計FreeGame中每個spin的hits（如果分數>0）
    if (spinScript.totalScore > 0) {
        gameState.hitsCount++;
        gameState.totalWin += spinScript.totalScore;
        gameState.balance += spinScript.totalScore;
    }
    // FreeGame的spin也計入總spin數
    gameState.totalSpinCount++;
    
    updateUI();
}

// 結束FreeGame
async function endFreeGame() {
    logDebug(`\n========== FreeGame 結束 ==========`);
    logDebug(`總次數: ${gameState.freeGameScript.totalSpins}`);
    logDebug(`總分數: ${gameState.freeGameScript.totalScore}`);
    logDebug(`最終Wild倍數: ${gameState.freeGameScript.endWildCount}`);
    logDebug(`Retrigger次數: ${gameState.freeGameScript.totalRetriggers}`);
    
    await sleep(getDelay('message'));
    
    // 重置狀態
    gameState.isFreeGame = false;
    gameState.freeGameScript = null;
    gameState.freeGameSpinIndex = 0;
    gameState.freeGameTotalScore = 0;
    // Wild倍數重置（不繼承到BaseGame）
    gameState.wildEliminateCount = 0;
    
    updateUIHideFreeGame();
    updateUI();
    
    gameState.isAnimating = false;  // FreeGame結束，恢復可點擊狀態
}

// Buy Feature - 購買FreeGame觸發（生成固定版面，等待手動spin）
async function onBuyFeature() {
    if (gameState.isAnimating) return;
    
    // ✅ 檢查金額是否足夠
    if (gameState.balance < 10000) {
        console.warn('⚠️ 金額不足！需要10000');
        alert('金額不足！需要10000');
        return;
    }
    
    gameState.isAnimating = true;

    // ✅ 重置本次得分
    gameState.totalScore = 0;

    // ✅ 扣附10000金額
    gameState.balance -= 10000;
    gameState.totalBet += 10000;
    gameState.totalSpinCount++;  // Buy Feature也算一次Spin
    updateUI();
    
    logDebug('\n=== Buy Feature - 生成觸發版面 ===');
    
    // 生成固定的Buy Feature版面
    const buyFeatureBoard = gameState.engine.generateBuyFeatureBoard();
    
    // 將版面保存到currentScript中，以便後續檢查
    gameState.currentScript = {
        initialBoard: buyFeatureBoard
    };
    
    // 將版面應用到grid並顯示
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < gameState.rowSizes[row]; col++) {
            gameState.grid[row][col].symbol = buyFeatureBoard[row][col];
        }
    }
    
    await renderInitialDropAnimation();
    
    gameState.isAnimating = false;
    gameState.buyFeaturePending = true;  // 設置待觸發標記
    
    logDebug('✨ Buy Feature版面已生成，請按Spin或空白鍵開始！');
}

// 更新UI顯示FreeGame資訊
function updateUIShowFreeGame() {
    document.getElementById('freeGameInfo').style.display = 'flex';
    // current是當前已完成的數量
    const current = gameState.freeGameSpinIndex;
    const total = gameState.freeGameScript ? gameState.freeGameScript.totalSpins : 0;
    document.getElementById('freegame-spins').textContent = `${current}/${total}`;
    
    // ✅ 切換到 FreeGame 背景
    const boardContainer = document.getElementById('boardContainer');
    boardContainer.classList.remove('base-game');
    boardContainer.classList.add('free-game');
    document.body.classList.add('free-game-mode');
}

// 更新UI隱藏FreeGame資訊
function updateUIHideFreeGame() {
    document.getElementById('freeGameInfo').style.display = 'none';
    
    // ✅ 切換回 BaseGame 背景
    const boardContainer = document.getElementById('boardContainer');
    boardContainer.classList.remove('free-game');
    boardContainer.classList.add('base-game');
    document.body.classList.remove('free-game-mode');
}

// 表演：顯示初始盤面
async function performInitialBoard(board) {
    logDebug('--- 表演：初始盤面 ---');
    
    // 將腳本的board應用到grid
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < gameState.rowSizes[row]; col++) {
            gameState.grid[row][col].symbol = board[row][col];
        }
    }
    
    // 執行下落動畫
    await renderInitialDropAnimation();
}

// 表演：執行一次Cascade
async function performCascade(cascade) {
    // 檢查是否為Mega符號放置
    if (cascade.isMegaPlacement) {
        return await performMegaPlacement(cascade);
    }
    
    gameState.eliminateCount++;
    
    logDebug(`--- Cascade #${cascade.index} 表演開始 ---`);
    logDebug(`消除組數: ${cascade.matchCount}, 總消除: ${cascade.totalMatched}個符號, 分數: ${cascade.totalScore}`);
    if (cascade.dropSet) {
        logDebug(`使用Drop Set: ${cascade.dropSet}`);
    }
    if (cascade.dropInfo && cascade.dropInfo.length > 0) {
        const dropInfoStr = cascade.dropInfo
            .map((info, row) => info ? `Row${row}(Set${info.dropSet},Pos${info.startIdx}/${info.dropLen},填充${info.fillCount})` : null)
            .filter(x => x)
            .join(', ');
        logDebug(`Drop詳情: ${dropInfoStr}`);
    }
    
    // 1. 標記並消除符號
    for (const match of cascade.matches) {
        for (const pos of match.positions) {
            const cell = gameState.grid[pos.row][pos.col];
            if (cell.symbol !== 0) { // 不消除Wild
                cell.element.classList.add('eliminating');
            }
        }
        
        logDebug(`消除: ${match.count}個符號${match.symbol}, 分數:${match.score}${match.containsWild ? ' (含Wild)' : ''}`);
    }
    
    // 動畫時間
    await sleep(getDelay('eliminate'));
    
    // 2. 清除符號
    for (const match of cascade.matches) {
        for (const pos of match.positions) {
            const cell = gameState.grid[pos.row][pos.col];
            if (cell.symbol !== 0) {
                cell.symbol = null;
                cell.element.classList.remove('eliminating');
                cell.element.innerHTML = '';
            }
        }
        
        // 更新分數（wildEliminateCount由Engine計算，不在這裡更新）
        gameState.totalScore += match.score;
    }
    
    // 【重要】從當前cascade同步wildEliminateCount（此cascade結束後的值）
    // 這樣UI會逐步顯示wildCount的增長，而不是直接跳到最終值
    if (cascade.wildEliminateCount !== undefined) {
        gameState.wildEliminateCount = cascade.wildEliminateCount;
    }
    
    // 更新Mega狀態（從cascade腳本中獲取）
    if (cascade.megaLevel !== undefined) {
        const oldLevel = gameState.megaLevel;
        const oldCount = gameState.megaEliminateCount;
        gameState.megaLevel = cascade.megaLevel;
        gameState.megaEliminateCount = cascade.megaEliminateCount;
        
        logDebug(`[普通Cascade] Mega狀態更新: Level ${oldLevel}→${cascade.megaLevel}, Count ${oldCount}→${cascade.megaEliminateCount}`);
    } else {
        logDebug(`[警告] Cascade #${cascade.index} 缺少megaLevel屬性！`);
    }
    
    updateUI();
    
    // 3. 應用重力（使用Engine計算的board快照）
    await performGravity(cascade.boardAfterGravity);
    
    // 4. 填充新符號（使用Engine計算的board快照）
    await performFill(cascade.boardAfterFill);
}

// 表演：Mega符號放置
async function performMegaPlacement(megaCascade) {
    logDebug(`\n--- Mega符號放置 ---`);
    logDebug(`放置數量: ${megaCascade.megaCount}個mega鑽石`);
    logDebug(`Mega符號: ${megaCascade.megaSymbol}`);
    
    // ✅ 根據 megaDiamonds 計算所有被覆蓋的格子（已完全避開Wild）
    const megaPositions = new Set();
    
    if (megaCascade.megaDiamonds && megaCascade.megaDiamonds.length > 0) {
        // 遍歷每個鑽石
        for (const diamond of megaCascade.megaDiamonds) {
            // ✅ 使用 cells 屬性（包含所有4個格子的board索引）
            if (diamond.cells && Array.isArray(diamond.cells)) {
                for (const [r, c] of diamond.cells) {
                    megaPositions.add(`${r},${c}`);
                }
            }
        }
    }
    
    logDebug(`檢測到${megaPositions.size}個mega格子（已完全避開Wild）`);
    
    // ✅ 應用Engine計算的完整board，給所有mega位置加轉動動畫
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < gameState.rowSizes[row]; col++) {
            const newSymbol = megaCascade.boardAfterMega[row][col];
            gameState.grid[row][col].symbol = newSymbol;
            updateCellDisplay(gameState.grid[row][col]);
            
            // ✅ 為mega位置添加轉動動畫（已避開Wild，所以都會改變）
            if (megaPositions.has(`${row},${col}`)) {
                const cellElement = gameState.grid[row][col].element;
                cellElement.classList.add('mega-appear');
                setTimeout(() => cellElement.classList.remove('mega-appear'), 800);
            }
        }
    }
    
    // 更新Mega狀態（從cascade獲取正確值，mega_level保留不重置）
    gameState.megaLevel = megaCascade.megaLevelAfterPlacement;
    gameState.megaEliminateCount = megaCascade.megaEliminateCountAfterPlacement;
    logDebug(`Mega放置後狀態: Level=${gameState.megaLevel}, Count=${gameState.megaEliminateCount}`);
    
    updateUI();
    
    await sleep(getDelay('mega'));
}

// 【已廢棄】表演：重力下落（重建版）- 不使用，以確保邏輯一致性
// async function performGravityAnimation() { ... }

// 【已廢棄】表演：填充新符號（重建版）- 不使用，以確保邏輯一致性  
// async function performFillAnimation(cascade) { ... }

// 表演：重力下落（使用Engine計算的board快照）
async function performGravity(targetBoard) {
    // 記錄舊位置
    const oldPositions = [];
    for (let row = 0; row < 7; row++) {
        oldPositions[row] = [];
        for (let col = 0; col < gameState.rowSizes[row]; col++) {
            oldPositions[row][col] = gameState.grid[row][col].symbol;
        }
    }
    
    // 應用目標board（保持Wild固定）
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < gameState.rowSizes[row]; col++) {
            // Wild位置固定不變
            if (row === 3 && col === 3) {
                gameState.grid[row][col].symbol = 0; // 確保Wild保持
            } else {
                gameState.grid[row][col].symbol = targetBoard[row][col];
            }
        }
    }
    
    // 執行動畫
    await renderBoardWithGravity(oldPositions);
}

// 表演：填充新符號
async function performFill(targetBoard) {
    // 應用目標board並執行動畫（保持Wild固定）
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < gameState.rowSizes[row]; col++) {
            // Wild位置跳過
            if (row === 3 && col === 3) continue;
            
            const cell = gameState.grid[row][col];
            if (cell.symbol === null && targetBoard[row][col] !== null) {
                cell.symbol = targetBoard[row][col];
                updateCellDisplay(cell);
                const img = cell.element.querySelector('img');
                if (img) {
                    img.style.animation = 'fall 0.5s ease-out';
                }
            }
        }
    }
    
    await sleep(500);
    
    // 清除動畫
    document.querySelectorAll('.hex-cell img').forEach(img => {
        img.style.animation = '';
    });
}

// =============== UI函數 ===============

// 計算Wild倍數（UI顯示用）
function getWildMultiplier(eliminateCount) {
    if (eliminateCount <= 1) return 1;
    if (eliminateCount === 2) return 2;
    return Math.min(2 + (eliminateCount - 2) * 2, 1000);
}

// 更新UI
function updateUI() {
    document.getElementById('balance').textContent = gameState.balance.toFixed(0);
    document.getElementById('score').textContent = gameState.totalScore.toFixed(0);
    document.getElementById('wild-mult').textContent = getWildMultiplier(gameState.wildEliminateCount) + 'x';
    document.getElementById('mega-level').textContent = gameState.megaLevel;
    document.getElementById('mega-count').textContent = gameState.megaEliminateCount;
    
    // ✅ 更新統計信息
    updateStats();
}

// ✅ 更新統計信息
function updateStats() {
    // 計算RTP
    const rtp = gameState.totalBet > 0 ? (gameState.totalWin / gameState.totalBet * 100) : 0;
    document.getElementById('rtp-value').textContent = rtp.toFixed(2) + '%';
    
    // 更新Spin數
    document.getElementById('spin-count').textContent = gameState.totalSpinCount;
    
    // 計算Hits率
    const hitsRate = gameState.totalSpinCount > 0 ? (gameState.hitsCount / gameState.totalSpinCount * 100) : 0;
    document.getElementById('hits-value').textContent = `${gameState.hitsCount} (${hitsRate.toFixed(1)}%)`;
}

// =============== 事件處理 ===============

// 清除選擇
function onClearSelection() {
    gameState.selectedCells.clear();
    document.querySelectorAll('.hex-cell.selected').forEach(el => {
        el.classList.remove('selected');
    });
}

// 單元格點擊（調試用）
function onCellClick(event) {
    const cell = event.currentTarget;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const key = `${row},${col}`;
    
    if (gameState.selectedCells.has(key)) {
        gameState.selectedCells.delete(key);
        cell.classList.remove('selected');
    } else {
        gameState.selectedCells.add(key);
        cell.classList.add('selected');
    }
    
    // 顯示鄰居信息和連通組信息
    const neighbors = getNeighbors(row, col);
    const cellData = gameState.grid[row][col];
    const group = findConnectedGroup(row, col);
    
    logDebug(`格子[${row},${col}] (realCol:${cellData.realCol}) 符號:${cellData.symbol} 鄰居:${neighbors.length}個 相連符號:${group.length}個`);
    
    // 列出鄰居的符號
    const neighborInfo = neighbors.map(n => {
        const nCell = gameState.grid[n.row][n.col];
        return `[${n.row},${n.col}]:${nCell.symbol}`;
    }).join(', ');
    logDebug(`鄰居: ${neighborInfo}`);
}

// 綁定事件
function attachEventListeners() {
    document.getElementById('spinBtn').addEventListener('click', onSpin);
    document.getElementById('buyFeatureBtn').addEventListener('click', onBuyFeature);
    document.getElementById('autoSpinBtn').addEventListener('click', onAutoSpin);
    document.getElementById('stopAutoBtn').addEventListener('click', onStopAuto);
    document.getElementById('speedToggleBtn').addEventListener('click', toggleSpeed);
    
    // 空白鍵觸發spin
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !gameState.isAnimating) {
            e.preventDefault();
            onSpin();
        }
    });
}

// Auto Spin 功能
async function onAutoSpin() {
    if (gameState.isAnimating || gameState.isAutoSpin) return;
    
    gameState.isAutoSpin = true;
    gameState.autoSpinCount = 0;
    
    // 更新按鈕顯示
    updateAutoSpinButtons();
    
    console.log('✅ 自動旋轉已啟動');
    
    // 自動旋轉循環
    while (gameState.isAutoSpin) {
        // ✅ 檢查金額是否足夠
        if (gameState.balance < 100) {
            console.log('⚠️ 金額不足，自動旋轉已停止');
            gameState.isAutoSpin = false;
            break;
        }
        
        gameState.autoSpinCount++;
        console.log(`🔄 Auto Spin #${gameState.autoSpinCount}`);
        
        await onSpin();
        
        // 等待一小段時間再繼續（讓玩家可以看清結果）
        if (gameState.isAutoSpin) {
            await sleep(getDelay('message') / 2);
        }
    }
    
    // ✅ 停止後更新按鈕狀態
    updateAutoSpinButtons();
}

// 停止 Auto Spin
function onStopAuto() {
    if (!gameState.isAutoSpin) return;
    
    gameState.isAutoSpin = false;
    console.log(`⛔ 自動旋轉已停止（共執行 ${gameState.autoSpinCount} 次）`);
    
    // 更新按鈕顯示
    updateAutoSpinButtons();
}

// 更新 Auto Spin 按鈕狀態
function updateAutoSpinButtons() {
    const autoSpinBtn = document.getElementById('autoSpinBtn');
    const stopAutoBtn = document.getElementById('stopAutoBtn');
    const spinBtn = document.getElementById('spinBtn');
    const buyFeatureBtn = document.getElementById('buyFeatureBtn');
    
    if (gameState.isAutoSpin) {
        autoSpinBtn.style.display = 'none';
        stopAutoBtn.style.display = 'block';
        spinBtn.disabled = true;
        buyFeatureBtn.disabled = true;
    } else {
        autoSpinBtn.style.display = 'block';
        stopAutoBtn.style.display = 'none';
        spinBtn.disabled = false;
        buyFeatureBtn.disabled = false;
    }
}

// =============== 工具函數 ===============

// 動態縮放 hex-grid 以適應容器大小
function scaleHexGrid() {
    const container = document.getElementById('boardContainer');
    const hexGrid = document.getElementById('hexGrid');

    if (!container || !hexGrid) return;

    const containerWidth = container.clientWidth - 40;  // 扣除 padding
    const containerHeight = container.clientHeight - 60;

    // 設計尺寸
    const designWidth = 600;
    const designHeight = 600;

    // 計算縮放比例（取較小值以完整顯示）
    const scale = Math.min(containerWidth / designWidth, containerHeight / designHeight, 1);

    hexGrid.style.transform = `scale(${scale})`;
    hexGrid.style.transformOrigin = 'center center';

    console.log(`📐 Grid scale: ${scale.toFixed(3)} (container: ${containerWidth}x${containerHeight})`);
}

// 調試日誌
// 調試日誌（默認關閉詳細日誌，只顯示關鍵信息）
const VERBOSE_LOG = false;  // 設為true可看到詳細日誌（⚡ 性能优化：建议关闭）
function logDebug(message) {
    if (!VERBOSE_LOG) return;  // 簡化模式：不輸出詳細日誌
    // 只输出到浏览器控制台
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${message}`);
}

// 工具函數：延遲
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============== 啟動 ===============

// 頁面加載完成後初始化
window.addEventListener('DOMContentLoaded', initGame);
