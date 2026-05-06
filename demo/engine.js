/**
 * 遊戲引擎 - 負責數值計算和腳本生成
 * 完全分離邏輯與表演
 */

class GameEngine {
    constructor(gameData) {
        this.data = gameData;
        this.rowSizes = [4, 5, 6, 7, 6, 5, 4];
        this.rowColMapping = [
            [3, 5, 7, 9],              // Row 0: 4個
            [2, 4, 6, 8, 10],          // Row 1: 5個
            [1, 3, 5, 7, 9, 11],       // Row 2: 6個
            [0, 2, 4, 6, 8, 10, 12],   // Row 3: 7個 (Wild在index 3)
            [1, 3, 5, 7, 9, 11],       // Row 4: 6個
            [2, 4, 6, 8, 10],          // Row 5: 5個
            [3, 5, 7, 9]               // Row 6: 4個
        ];
        // Retrigger規則: C1數量 -> 額外spin數
        this.retriggerMap = {3: 10, 4: 12, 5: 15, 6: 20, 7: 30};
        // 符號名稱映射
        this.symbolNames = {
            0: 'WILD', 1: 'C1', 2: 'M1', 3: 'M2', 4: 'M3',
            5: 'M4', 6: 'M5', 7: 'M6', 8: 'M7',
            9: 'MY1', 10: 'MY2', 11: 'MY3'
        };
        // 關閉所有詳細日誌（只顯示分數）
        this.verboseLog = false;  // 設為true可開啟詳細日誌
        // 性能優化：減少board快照存儲（只保留必要的）
        this.performanceMode = true;  // 設為false可存儲完整快照用於調試
        // 性能優化：複用visited數組（避免重複創建）
        this.visitedCache = Array(7).fill(null).map(() => Array(13).fill(false));
        this.wildInQueueCache = Array(7).fill(null).map(() => Array(13).fill(false));
    }
    
    // 條件日誌（只在verboseLog=true時輸出）
    log(message) {
        if (this.verboseLog) {
            console.log(message);
        }
    }
    
    // 條件性cloneBoard（性能模式下只clone必要的board）
    cloneBoardIfNeeded(board, isRequired = false) {
        if (isRequired || !this.performanceMode) {
            return this.cloneBoard(board);
        }
        return null;  // 性能模式下跳過非必要的clone
    }

    // ==================== 工具函數 ====================
    
    weightedChoice(weights) {
        const total = weights.reduce((sum, w) => sum + w, 0);
        const r = Math.random() * total;
        let cumulative = 0;
        for (let i = 0; i < weights.length; i++) {
            cumulative += weights[i];
            if (r < cumulative) {
                return i;
            }
        }
        return weights.length - 1;
    }

    getWildMultiplier(eliminateCount) {
        // Wild倍数序列：[1, 1, 2, 4, 6, 8, 10, 12, ..., 1000]
        // 前两次Wild消除(count=0和1)倍数为1，从第三次(count=2)开始才有加成
        if (eliminateCount <= 1) return 1;  // 第1、2次: 倍数1
        if (eliminateCount === 2) return 2;  // 第3次: 倍数2
        return Math.min(2 + (eliminateCount - 2) * 2, 1000);  // 第4次起: 4, 6, 8...
    }
    
    // ==================== 重抽機制 ====================
    
    /**
     * 根據倍數找到對應的區間索引
     * multipleRange = [0,1,2,3,...,25000] 長度57
     * 代表58個區間：a<=0, 0<a<=1, 1<a<=2, ..., 25000<a
     */
    getMultipleRangeIndex(multiple) {
        if (!this.data.multipleRange) {
            console.warn('警告：multipleRange未定義，重抽機制無法使用');
            return -1;
        }
        
        const ranges = this.data.multipleRange;
        
        // 找到第一個大於等於multiple的範圍
        for (let i = 0; i < ranges.length; i++) {
            if (multiple <= ranges[i]) {
                return i;
            }
        }
        
        // 超過最大範圍 (>25000)
        return ranges.length;
    }
    
    /**
     * 檢查是否需要重抽
     * @param {number} totalScore - 總分數
     * @param {number} bet - 下注金額（默認1）
     * @param {boolean} isFreeGame - 是否為FreeGame
     * @returns {boolean} 是否需要重抽
     */
    shouldRedraw(totalScore, bet = 1, isFreeGame = false) {
        const multiple = totalScore / bet;
        const rangeIndex = this.getMultipleRangeIndex(multiple);
        
        if (rangeIndex === -1) return false;
        
        // 選擇對應的重抽率向量
        const redrawRates = isFreeGame ? this.data.freeredraw : this.data.baseredraw;
        
        if (!redrawRates || rangeIndex >= redrawRates.length) {
            console.warn(`警告：重抽率索引越界 (index=${rangeIndex}, length=${redrawRates?.length})`);
            return false;
        }
        
        const redrawRate = redrawRates[rangeIndex];
        const randomValue = Math.random();
        
        this.log(`倍數: ${multiple.toFixed(2)}x (分數${totalScore}/bet${bet}), 區間索引: ${rangeIndex}, 重抽率: ${(redrawRate * 100).toFixed(1)}%, 隨機值: ${randomValue.toFixed(3)}`);
        
        return randomValue < redrawRate;
    }
    
    // 獲取鑽石形狀的4格（用於Mega符號放置）
    getDiamondCells(centerRow, centerCol) {
        return [
            { row: centerRow, col: centerCol },
            { row: centerRow, col: centerCol - 2 },
            { row: centerRow + 1, col: centerCol - 1 },
            { row: centerRow + 1, col: centerCol + 1 }
        ];
    }
    
    // 檢查realCol是否在指定行的有效列中
    isValidHexCell(row, realCol) {
        if (row < 0 || row >= 7) return false;
        return this.rowColMapping[row].includes(realCol);
    }
    
    // 計算盤面上C1（符號1）的數量
    countC1(board) {
        if (!board || !Array.isArray(board)) {
            console.error('countC1: board 無效', board);
            return 0;
        }
        
        let count = 0;
        for (let row = 0; row < 7; row++) {
            if (!board[row] || !Array.isArray(board[row])) {
                console.error(`countC1: board[${row}] 無效`, board[row]);
                continue;
            }
            for (let col = 0; col < this.rowSizes[row]; col++) {
                if (board[row][col] === 1) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // 檢查C1數量是否觸發Retrigger（額外spin）
    checkRetrigger(board) {
        const c1Count = this.countC1(board);
        if (c1Count in this.retriggerMap) {
            return {
                triggered: true,
                c1Count: c1Count,
                extraSpins: this.retriggerMap[c1Count]
            };
        }
        return { triggered: false, c1Count: c1Count, extraSpins: 0 };
    }
    
    // 生成Buy Feature的固定版面（用於觸發FreeGame）
    generateBuyFeatureBoard() {
        const board = [
            [2, 2, 2, 1],              // Row 0
            [3, 3, 3, 3, 3],           // Row 1
            [5, 5, 5, 4, 4, 4],        // Row 2
            [6, 6, 6, 0, 7, 7, 1],     // Row 3 (Wild在index 3)
            [8, 8, 8, 8, 7, 7],        // Row 4
            [3, 3, 3, 3, 3],           // Row 5
            [2, 2, 2, 1]               // Row 6
        ];
        this.log('生成Buy Feature固定版面（C1=3，應觸發+10次FreeGame）');
        return board;
    }

    // ==================== Reel/Drop 選擇 ====================

    selectReelSet() {
        if (!this.data || !this.data.ReelWeight) {
            return Math.floor(Math.random() * 5) + 1;
        }
        const idx = this.weightedChoice(this.data.ReelWeight);
        return idx + 1; // 1-5
    }

    selectDropSet(eliminateCount) {
        if (!this.data || !this.data.DropWeight) {
            return Math.floor(Math.random() * 6) + 1;
        }
        
        // 根據消除次數選擇權重行
        let rowIdx = 0;
        if (eliminateCount <= 0) {
            rowIdx = 0;
        } else if (eliminateCount >= 10) {
            rowIdx = 9;
        } else {
            rowIdx = eliminateCount - 1;
        }
        
        const dropWeights = this.data.DropWeight[rowIdx];
        const idx = this.weightedChoice(dropWeights);
        return idx + 1; // 1-6
    }

    // ==================== 符號生成 ====================

    generateInitialBoard(reelSet, isFreeGame = false) {
        const board = [];
        const reelInfo = [];  // 記錄每行的reel配置
        const prefix = isFreeGame ? 'FreeGame' : 'baseGame';
        const symbolKey = `${prefix}Symbol${reelSet}`;
        const weightKey = `${prefix}SymbolWeight${reelSet}`;
        const myKey = `${prefix}MY${reelSet}`;
        
        if (!this.data || !this.data[symbolKey] || !this.data[weightKey]) {
            // 降級為簡單隨機
            return { board: this.generateSimpleRandomBoard(), reelInfo: [] };
        }

        const symbols = this.data[symbolKey];
        const weights = this.data[weightKey];
        const myWeights = this.data[myKey];

        // 每行使用reel帶邏輯（匹配Python版本）
        for (let row = 0; row < 7; row++) {
            board[row] = [];
            const reelRow = symbols[row];
            const weightRow = weights[row];
            
            // 根據權重抽選起始位置
            const startIdx = this.weightedChoice(weightRow);
            const reelLen = reelRow.length;
            
            // 記錄reel配置
            reelInfo[row] = { reelSet, startIdx, reelLen };
            
            // ✅ Row 3 特殊處理：抽選連續7個符號，取前3個和後3個
            if (row === 3) {
                // 抽選連續7個符號
                const sevenSymbols = [];
                for (let i = 0; i < 7; i++) {
                    const symbolValue = reelRow[(startIdx + i) % reelLen];
                    sevenSymbols.push(symbolValue === 0 ? 1 : symbolValue);
                }
                
                // 前3個：放在 col=0,1,2
                board[row][0] = sevenSymbols[0];
                board[row][1] = sevenSymbols[1];
                board[row][2] = sevenSymbols[2];
                // 中間：Wild (col=3)
                board[row][3] = 0; // Wild
                // 後3個：放在 col=4,5,6 (跳過第3個符號)
                board[row][4] = sevenSymbols[4];
                board[row][5] = sevenSymbols[5];
                board[row][6] = sevenSymbols[6];
                
                this.log(`Row 3 抽選: [${sevenSymbols.join(',')}] -> 前3[${sevenSymbols.slice(0,3).join(',')}] Wild 後3[${sevenSymbols.slice(4).join(',')}]`);
            } else {
                // 其他行：正常連續取符號
                for (let col = 0; col < this.rowSizes[row]; col++) {
                    // 從reel帶連續取符號
                    const symbolValue = reelRow[(startIdx + col) % reelLen];
                    // 0視為C1(1)，其他直接使用
                    board[row][col] = symbolValue === 0 ? 1 : symbolValue;
                }
            }
        }
        
        // 轉換MY符號（9,10,11 → 0-8）
        let myTargets = null;
        if (myWeights && myWeights.length > 0) {
            myTargets = this.convertMySymbols(board, myWeights);
        }

        return { board, reelInfo, myTargets };
    }

    generateSimpleRandomBoard() {
        const board = [];
        for (let row = 0; row < 7; row++) {
            board[row] = [];
            for (let col = 0; col < this.rowSizes[row]; col++) {
                if (row === 3 && col === 3) {
                    board[row][col] = 0; // Wild
                } else {
                    board[row][col] = Math.floor(Math.random() * 7) + 2; // M1-M7
                }
            }
        }
        return board;
    }

    fillDropSymbols(board, dropSet, eliminateCount, isFreeGame = false) {
        const dropInfo = [];  // 記錄每行的drop配置
        const prefix = isFreeGame ? 'FreeGameDrop' : 'BaseGameDrop';
        const dropKey = `${prefix}${dropSet}`;
        const weightKey = `${prefix}RWeight${dropSet}`;
        const myKey = `${prefix}My${dropSet}`;
        
        if (!this.data || !this.data[dropKey] || !this.data[weightKey]) {
            // 降級為簡單隨機
            this.fillSimpleRandom(board);
            return { dropInfo: [] };
        }

        const dropSymbols = this.data[dropKey];
        const dropWeights = this.data[weightKey];
        const dropMyWeights = this.data[myKey];

        // 每行使用reel帶邏輯填充空位（匹配Python的fill_empty_method0）
        for (let row = 0; row < 7; row++) {
            if (row >= dropSymbols.length) continue;
            
            const dropRow = dropSymbols[row];
            const dropWeightRow = dropWeights[row];
            const dropLen = dropRow.length;
            
            // 為當前行抽取reel帶的起始位置
            const startIdx = this.weightedChoice(dropWeightRow);
            let offset = 0; // reel帶偏移量
            
            let fillCount = 0;
            
            // ✅ 檢查該行是否已有C1
            let hasC1InRow = false;
            for (let col = 0; col < this.rowSizes[row]; col++) {
                if (row === 3 && col === 3) continue; // 跳過Wild
                if (board[row][col] === 1) {
                    hasC1InRow = true;
                    break;
                }
            }
            
            // 按順序掃描，填充空位
            for (let col = 0; col < this.rowSizes[row]; col++) {
                // Wild位置跳過
                if (row === 3 && col === 3) continue;
                
                if (board[row][col] === null) {
                    // 從reel帶的起始位置開始順序取符號
                    let symbolValue = dropRow[(startIdx + offset) % dropLen];
                    offset++; // reel帶移動一個位置
                    
                    // ✅ C1重複檢查：如果該行已有C1且新符號是C1，改為MY1(9)
                    if (symbolValue === 0) {
                        if (hasC1InRow) {
                            symbolValue = 9; // 改為MY1
                            this.log(`Row ${row} 已有C1，掉落C1改為MY1 at [${row},${col}]`);
                        } else {
                            symbolValue = 1; // 0視為C1(1)
                            hasC1InRow = true; // 標記該行已有C1
                        }
                    }
                    
                    board[row][col] = symbolValue;
                    fillCount++;
                }
            }
            
            if (fillCount > 0) {
                // 記錄drop配置
                dropInfo[row] = { dropSet, startIdx, dropLen, fillCount };
            }
        }
        
        // 轉換MY符號（9,10,11 → 0-8）
        let dropMyTargets = null;
        if (dropMyWeights && dropMyWeights.length > 0) {
            dropMyTargets = this.convertMySymbols(board, dropMyWeights);
        }
        
        return { dropInfo, dropMyTargets };
    }

    fillSimpleRandom(board) {
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.rowSizes[row]; col++) {
                if (board[row][col] === null) {
                    board[row][col] = Math.floor(Math.random() * 7) + 2;
                }
            }
        }
    }
    
    // ==================== MY符號轉換 ====================
    
    convertMySymbols(board, myWeights) {
        // MY符號: 9=MY1, 10=MY2, 11=MY3
        // 根據權重將它們轉換成0-8的普通符號
        if (!myWeights || myWeights.length === 0) {
            return null;
        }
        
        // ✅ 按順序抽選MY1→MY2→MY3，動態調整權重確保不重複
        const myTargets = [];
        
        for (let myIdx = 0; myIdx < Math.min(3, myWeights.length); myIdx++) {
            // 複製當前權重（避免修改原始數據）
            const currentWeights = [...myWeights[myIdx]];
            
            // 將已選中的符號權重設為0
            for (let prevIdx = 0; prevIdx < myIdx; prevIdx++) {
                const prevSymbol = myTargets[prevIdx];
                if (prevSymbol !== undefined && prevSymbol < currentWeights.length) {
                    currentWeights[prevSymbol] = 0;
                }
            }
            
            // 檢查是否還有可選符號
            const totalWeight = currentWeights.reduce((sum, w) => sum + w, 0);
            if (totalWeight === 0) {
                this.log(`警告: MY${myIdx + 1} 無可用權重，使用fallback`);
                // Fallback: 找一個未使用的符號
                for (let s = 0; s <= 8; s++) {
                    if (!myTargets.includes(s)) {
                        myTargets[myIdx] = s;
                        break;
                    }
                }
            } else {
                // 根據調整後的權重抽選
                myTargets[myIdx] = this.weightedChoice(currentWeights);
            }
        }
        
        this.log(`MY符號轉換目標（順序抽選不重複）: MY1(9)→${myTargets[0]}, MY2(10)→${myTargets[1]}, MY3(11)→${myTargets[2]}`);
        
        // 統一轉換所有MY符號
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.rowSizes[row]; col++) {
                const symbol = board[row][col];
                if (symbol >= 9 && symbol <= 11) {
                    const myIdx = symbol - 9;
                    if (myIdx < myTargets.length && myTargets[myIdx] !== undefined) {
                        board[row][col] = myTargets[myIdx];
                    }
                }
            }
        }
        
        return myTargets; // 返回轉換映射 [MY1目標, MY2目標, MY3目標]
    }
    
    // ==================== Mega符號放置 ====================
    
    placeMegaSymbols(board, megaEliminateCount) {
        if (megaEliminateCount <= 0) return null;
        
        // 檢查Eliminate權重
        if (!this.data || !this.data.Eliminate || this.data.Eliminate.length === 0) {
            this.log('警告：Eliminate權重無效，跳過mega符號放置');
            return null;
        }
        
        // 只抽選一次符號，所有鑽石使用同一符號
        const eliminateWeights = this.data.Eliminate;
        const megaSymbolId = this.weightedChoice(eliminateWeights);
        
        this.log(`\n=== Mega符號放置 ===`);
        this.log(`需要放置: ${megaEliminateCount}個鑽石`);
        this.log(`選定符號ID: ${megaSymbolId} (對應M${megaSymbolId-1})`);
        this.log(`鑽石形狀（匹配Python）:`);
        this.log(`  [r,c], [r,c-2], [r+1,c-1], [r+1,c+1]`);
        
        const placedDiamonds = []; // 記錄放置的鑽石中心點
        
        // 【修正】定義所有可能的鑽石中心點（完全匹配Python）
        const allPossibleCenters = [
            // Row 0: 有效列 [3,5,7,9]
            [0, 5], [0, 7], [0, 9],
            // Row 1: 有效列 [2,4,6,8,10]
            [1, 4], [1, 6], [1, 8], [1, 10],
            // Row 2: 有效列 [1,3,5,7,9,11]
            // 排除 (2,5),(2,7) 因為會包含Wild[3,6]
            [2, 3], [2, 9], [2, 11],
            // Row 3: 有效列 [0,2,4,6,8,10,12]
            // 排除 (3,6) 因為本身是Wild, 排除 (3,8) 因為會包含Wild[3,6]
            [3, 2], [3, 4], [3, 10], [3, 12],
            // Row 4: 有效列 [1,3,5,7,9,11]
            [4, 3], [4, 5], [4, 7], [4, 9], [4, 11],
            // Row 5: 有效列 [2,4,6,8,10]
            [5, 4], [5, 6], [5, 8]
        ];
        
        let placedBlocks = 0;
        const occupiedCells = new Set();
        occupiedCells.add('3,3'); // ✅ Wild位置（board索引）- 完全避开Wild
        
        for (let i = 0; i < megaEliminateCount; i++) {
            // 篩選當前可放置的位置
            const validCenters = [];
            
            for (const [centerRow, centerRealCol] of allPossibleCenters) {
                // 【修正】計算鑽石形狀的4格（匹配Python）
                // Python: [r,c], [r,c-2], [r+1,c-1], [r+1,c+1]
                const blockCells = [
                    [centerRow, centerRealCol],           // 中心
                    [centerRow, centerRealCol - 2],       // 左
                    [centerRow + 1, centerRealCol - 1],   // 下左
                    [centerRow + 1, centerRealCol + 1]    // 下右
                ];
                
                // 檢查所有4格是否都有效
                const allValid = blockCells.every(([r, rc]) => this.isValidHexCell(r, rc));
                if (!allValid) continue;
                
                // 轉換為board索引並檢查是否有效
                const boardCells = [];
                let hasInvalidCell = false;
                
                for (const [r, rc] of blockCells) {
                    const colIdx = this.rowColMapping[r].indexOf(rc);
                    if (colIdx === -1) {
                        hasInvalidCell = true;
                        break;
                    }
                    boardCells.push([r, colIdx]);
                }
                
                // 如果有任何格子轉換失敗，跳過這個中心點
                if (hasInvalidCell) continue;
                
                // ✅ 檢查是否有任何格子被占用（Wild或其他Mega）
                const isOccupied = boardCells.some(([r, c]) => {
                    const key = `${r},${c}`;
                    return occupiedCells.has(key); // 包括Wild(3,3)和Mega已占用位置
                });
                if (isOccupied) continue;
                
                // 第一個鑽石需要與現有的megaSymbolId相鄰
                if (placedBlocks === 0) {
                    let hasAdjacent = false;
                    for (const [r, c] of boardCells) {
                        const neighbors = this.getNeighbors(r, c);
                        for (const neighbor of neighbors) {
                            // 檢查是否在鑽石格子外且符號匹配
                            const isInBlock = boardCells.some(([br, bc]) => br === neighbor.row && bc === neighbor.col);
                            if (!isInBlock && board[neighbor.row][neighbor.col] === megaSymbolId) {
                                hasAdjacent = true;
                                break;
                            }
                        }
                        if (hasAdjacent) break;
                    }
                    if (!hasAdjacent) continue;
                }
                
                // 這個中心點可用
                validCenters.push(boardCells);
            }
            
            // 如果沒有可放置的位置
            if (validCenters.length === 0) {
                this.log(`無法放置第${placedBlocks + 1}個鑽石，停止放置`);
                break;
            }
            
            // 隨機選擇一個位置
            const selectedIdx = Math.floor(Math.random() * validCenters.length);
            const boardCells = validCenters[selectedIdx];
            
            // 記錄鑽石信息（✅ 保存所有4個格子，用於前端轉動表演）
            const centerRow = boardCells[0][0];
            const centerCol = boardCells[0][1];
            placedDiamonds.push({ 
                row: centerRow, 
                col: centerCol,
                cells: boardCells  // ✅ 保存所有4個格子的board索引
            });
            
            // ✅ 放置4格鑽石到board（跳過C1，保持C1不變）
            for (const [r, c] of boardCells) {
                if (board[r][c] === 1) {  // C1符號跳過，保持不變
                    continue;
                }
                board[r][c] = megaSymbolId;
                occupiedCells.add(`${r},${c}`);
            }
            
            placedBlocks++;
        }
        
        this.log(`成功放置: ${placedBlocks}/${megaEliminateCount}個鑽石`);
        this.log(`放置條件: 1)不互相覆蓋 2)避開Wild 3)保留C1`);
        
        return placedBlocks > 0 ? { 
            symbol: megaSymbolId, 
            diamonds: placedDiamonds 
        } : null;
    }

    // ==================== 相鄰與消除判斷 ====================

    // 調試：可視化盤面
    debugBoard(board, title = '盤面') {
        console.log(`\n=== ${title} ===`);
        for (let row = 0; row < 7; row++) {
            const symbols = board[row].map(s => s === null ? '_' : s === 0 ? 'W' : s).join(',');
            console.log(`Row${row}: [${symbols}]`);
        }
    }

    // 調試：顯示某個符號的所有位置和鄰居
    debugSymbolConnections(board, targetSymbol) {
        this.log(`\n=== 符號${targetSymbol}的連通性分析 ===`);
        
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.rowSizes[row]; col++) {
                if (board[row][col] === targetSymbol) {
                    const realCol = this.rowColMapping[row][col];
                    const neighbors = this.getNeighbors(row, col);
                    const matchingNeighbors = neighbors.filter(n => {
                        const nSymbol = board[n.row][n.col];
                        return nSymbol === targetSymbol || nSymbol === 0;
                    });
                    
                    this.log(`  [${row},${col}] realCol=${realCol}: ${matchingNeighbors.length}個相連鄰居`);
                    matchingNeighbors.forEach(n => {
                        const nSymbol = board[n.row][n.col];
                        const nRealCol = this.rowColMapping[n.row][n.col];
                        this.log(`    → [${n.row},${n.col}] symbol=${nSymbol} realCol=${nRealCol}`);
                    });
                }
            }
        }
    }

    getNeighbors(row, col) {
        const neighbors = [];
        const realCol = this.rowColMapping[row][col];
        
        // 六角网格的六个方向（匹配Python版本）
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
            
            if (newRow < 0 || newRow >= 7) continue;
            
            // 在新行中查找對應的列
            for (let i = 0; i < this.rowSizes[newRow]; i++) {
                if (this.rowColMapping[newRow][i] === newRealCol) {
                    neighbors.push({ row: newRow, col: i });
                    break;
                }
            }
        }
        
        return neighbors;
    }

    findConnectedGroup(board, startRow, startCol, visited) {
        const symbol = board[startRow][startCol];
        if (symbol === null || symbol === 0) return []; // 不從Wild開始
        if (visited[startRow][startCol]) return [];
        
        const queue = [{ row: startRow, col: startCol }];
        const group = [];
        // 性能優化：複用wildInQueue數組並重置
        const wildInQueue = this.wildInQueueCache;
        for (let r = 0; r < 7; r++) {
            wildInQueue[r].fill(false);
        }
        visited[startRow][startCol] = true;
        
        // 性能優化：使用索引而非shift()（O(1) vs O(n)）
        let queueIndex = 0;
        while (queueIndex < queue.length) {
            const current = queue[queueIndex++];
            group.push(current);
            
            const neighbors = this.getNeighbors(current.row, current.col);
            
            for (const neighbor of neighbors) {
                const neighborSymbol = board[neighbor.row][neighbor.col];
                if (neighborSymbol === null) continue;
                
                // 處理相同符號
                if (neighborSymbol === symbol) {
                    if (!visited[neighbor.row][neighbor.col]) {
                        visited[neighbor.row][neighbor.col] = true;
                        queue.push(neighbor);
                    }
                }
                // 處理Wild符號（Wild不標記visited，可以被多個組使用）
                else if (neighborSymbol === 0) {
                    if (!wildInQueue[neighbor.row][neighbor.col]) {
                        wildInQueue[neighbor.row][neighbor.col] = true;
                        queue.push(neighbor);
                    }
                }
            }
        }
        
        return group;
    }

    findAllMatches(board) {
        // 性能優化：複用visited數組並重置（避免重複創建）
        const visited = this.visitedCache;
        for (let r = 0; r < 7; r++) {
            visited[r].fill(false);
        }
        const matches = [];
        
        // 調試：檢查所有連通組
        const allGroups = [];
        
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < this.rowSizes[row]; col++) {
                if (visited[row][col]) continue;
                if (board[row][col] === null) continue;
                
                const group = this.findConnectedGroup(board, row, col, visited);
                
                if (group.length > 0) {
                    allGroups.push({
                        symbol: board[row][col],
                        count: group.length,
                        start: `[${row},${col}]`
                    });
                }
                
                if (group.length >= 6) {
                    matches.push({
                        symbol: board[row][col],
                        positions: group
                    });
                }
            }
        }
        
        // 列出所有找到的連通組（包括小於6個的）
        if (allGroups.length > 0) {
            this.log('找到的連通組:');
            allGroups.forEach(g => {
                const mark = g.count >= 6 ? '✓ 可消除' : '';
                this.log(`  符號${g.symbol}: ${g.count}個 起點${g.start} ${mark}`);
            });
        }
        
        return matches;
    }

    // ==================== 分數計算 ====================

    calculateScore(match, wildEliminateCount) {
        const symbol = match.symbol;
        const count = match.positions.length;
        
        // 檢查是否包含Wild
        const containsWild = match.positions.some(pos => 
            pos.row === 3 && pos.col === 3
        );
        
        // 查linkpoint表
        const symbolIndex = symbol - 2;
        const countIndex = Math.min(count - 6, 9);
        
        if (!this.data || !this.data.linkpoint) return 0;
        if (symbolIndex < 0 || symbolIndex >= this.data.linkpoint.length) return 0;
        if (countIndex < 0 || countIndex >= this.data.linkpoint[symbolIndex].length) return 0;
        
        const baseScore = this.data.linkpoint[symbolIndex][countIndex];
        
        // 應用Wild倍數
        if (containsWild) {
            const wildMult = this.getWildMultiplier(wildEliminateCount);
            const finalScore = baseScore * wildMult;
            this.log(`  [計分] 符號${symbol}, 數量${count}, 基礎分${baseScore}, Wild倍數x${wildMult} (wildCount=${wildEliminateCount}), 最終分數=${finalScore}`);
            return finalScore;
        }
        
        this.log(`  [計分] 符號${symbol}, 數量${count}, 基礎分${baseScore} (無Wild)`);
        return baseScore;
    }

    // ==================== 下落處理 ====================

    applyGravity(board) {
        // 符號向下掉落（向低col索引方向，匹配Python）
        this.log('--- 應用重力 ---');
        for (let row = 0; row < 7; row++) {
            const rowSize = this.rowSizes[row];
            const before = [...board[row]];
            
            // 收集非空且非Wild的符號（按索引順序）
            const nonEmptySymbols = [];
            for (let col = 0; col < rowSize; col++) {
                const symbol = board[row][col];
                // Wild固定位置不移動
                if (row === 3 && col === 3) continue;
                // 收集非空符號
                if (symbol !== null && symbol !== 0) {
                    nonEmptySymbols.push(symbol);
                }
            }
            
            // 從左往右填充（符號掉到左邊/低col索引方向，匹配Python）
            let idx = 0;
            for (let col = 0; col < rowSize; col++) {
                // Wild固定位置跳過
                if (row === 3 && col === 3) continue;
                
                if (idx < nonEmptySymbols.length) {
                    board[row][col] = nonEmptySymbols[idx];
                    idx++;
                } else {
                    board[row][col] = null; // 右側（高col索引）填充null
                }
            }
            
            const after = [...board[row]];
            if (JSON.stringify(before) !== JSON.stringify(after)) {
                this.log(`Row${row}: [${before.join(',')}] → [${after.join(',')}]`);
            }
        }
    }

    // ==================== 生成完整腳本 ====================

    // 生成一次完整的Spin腳本
    // currentMegaLevel: 本次Spin的起始等級（通常為0，每次Spin重置）
    // currentMegaEliminateCount: 累積的Mega消除次數（跨Spin保存）
    // startWildCount: Wild消除次數的起始值（BaseGame為0，FreeGame累積）
    generateSpinScript(currentMegaLevel = 0, currentMegaEliminateCount = 0, isFreeGame = false, startWildCount = 0, bet = 1, enableRedraw = true, maxRedrawAttempts = 100) {
        let attempts = 0;
        let script = null;
        
        // 重抽循環
        while (attempts < maxRedrawAttempts) {
            attempts++;
            
            script = this._generateSingleSpin(currentMegaLevel, currentMegaEliminateCount, isFreeGame, startWildCount);
            
            // 檢查是否需要重抽
            if (enableRedraw && this.shouldRedraw(script.totalScore, bet, isFreeGame)) {
                this.log(`🔄 重抽觸發！(第${attempts}次嘗試，倍數${(script.totalScore / bet).toFixed(2)}x)`);
                continue;  // 重新生成
            }
            
            // 不需要重抽，跳出循環
            break;
        }
        
        if (attempts >= maxRedrawAttempts) {
            console.warn(`⚠️ 達到最大重抽次數(${maxRedrawAttempts})，使用最後一次結果`);
        }
        
        if (attempts > 1) {
            this.log(`✅ 重抽完成，共嘗試${attempts}次`);
        }
        
        // ✅ 記錄重抽次數
        script.redrawAttempts = attempts;
        
        return script;
    }
    
    // 內部函數：生成單次spin（不含重抽邏輯）
    _generateSingleSpin(currentMegaLevel = 0, currentMegaEliminateCount = 0, isFreeGame = false, startWildCount = 0) {
        const script = {
            reelSet: this.selectReelSet(),
            initialBoard: null,
            cascades: [],
            totalScore: 0,
            wildEliminateCount: startWildCount,  // FreeGame中從累積值開始，BaseGame從0開始
            megaLevel: currentMegaLevel,           // 每次Spin從0開始
            megaEliminateCount: currentMegaEliminateCount,   // 跨Spin累積
            isFreeGame: isFreeGame
        };

        this.log(`=== ${isFreeGame ? 'FreeGame' : 'BaseGame'} Spin腳本生成 ===`);
        this.log(`Reel Set: ${script.reelSet}`);
        this.log(`起始Mega狀態: Level=${currentMegaLevel}(本Spin內), Count=${currentMegaEliminateCount}(累積)`);
        this.log(`起始Wild次數: ${startWildCount} (${isFreeGame ? 'FreeGame累積' : 'BaseGame重置'})`);

        // 生成初始盤面
        const initialResult = this.generateInitialBoard(script.reelSet, isFreeGame);
        script.initialBoard = initialResult.board;
        script.reelInfo = initialResult.reelInfo;  // 記錄reel配置
        script.initialMyTargets = initialResult.myTargets;  // 記錄MY轉換
        this.log('初始盤面:', this.boardToString(script.initialBoard));
        this.log('Reel配置:', initialResult.reelInfo.map((info, row) => 
            `Row${row}: Set${info.reelSet}, Start=${info.startIdx}/${info.reelLen}`).join(', '));
        if (initialResult.myTargets) {
            this.log('MY轉換:', `MY1→${initialResult.myTargets[0]}, MY2→${initialResult.myTargets[1]}, MY3→${initialResult.myTargets[2]}`);
        }

        let board = this.cloneBoard(script.initialBoard);
        let cascadeCount = 0;

        // Cascade循環
        while (true) {
            const matches = this.findAllMatches(board);
            
            if (matches.length === 0) {
                if (cascadeCount === 0) {
                    // 初始盤面沒有消除，顯示詳細分析
                    this.log('\n初始盤面無可消除組 - 詳細分析:');
                    
                    // 統計每個符號的數量
                    const symbolCounts = {};
                    for (let row = 0; row < 7; row++) {
                        for (let col = 0; col < this.rowSizes[row]; col++) {
                            const symbol = board[row][col];
                            if (symbol !== null && symbol !== 0) {
                                symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
                            }
                        }
                    }
                    this.log('符號統計:', symbolCounts);
                    
                    // 分析出現最多的符號
                    const mostCommon = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0];
                    if (mostCommon && mostCommon[1] >= 3) {
                        this.log(`\n最多的符號: ${mostCommon[0]} (${mostCommon[1]}個)`);
                        this.debugSymbolConnections(board, parseInt(mostCommon[0]));
                    }
                }
                
                // 嘗試放置Mega符號
                if (script.megaEliminateCount > 0) {
                    this.log(`\n檢測到megaEliminateCount=${script.megaEliminateCount}，嘗試放置Mega符號`);
                    const boardBeforeMega = this.cloneBoard(board);  // 保留放置前快照
                    const megaPlacement = this.placeMegaSymbols(board, script.megaEliminateCount);
                    
                    if (megaPlacement) {
                        // 成功放置，創建一個特殊的cascade記錄mega放置
                        cascadeCount++;
                        
                        // 記錄簡化信息+完整board快照
                        const megaCascade = {
                            index: cascadeCount,
                            isMegaPlacement: true,  // 標記為mega放置
                            megaCount: script.megaEliminateCount,
                            megaSymbol: megaPlacement.symbol,  // Mega符號ID（簡化信息）
                            megaDiamonds: megaPlacement.diamonds,  // 中心點列表（簡化信息）
                            boardBeforeMega: boardBeforeMega,  // 完整快照（確保邏輯一致）
                            boardAfterMega: this.cloneBoard(board),  // 完整快照（確保邏輯一致）
                            megaLevel: script.megaLevel,  // 記錄放置前的mega level
                            megaEliminateCount: script.megaEliminateCount  // 記錄放置前的count
                        };
                        
                        // 重置mega狀態並繼續循環
                        script.megaEliminateCount = 0;
                        script.megaLevel = 0;
                        
                        // 更新cascade中的mega狀態為重置後的值
                        megaCascade.megaLevelAfterPlacement = 0;
                        megaCascade.megaEliminateCountAfterPlacement = 0;
                        
                        script.cascades.push(megaCascade);
                        continue;
                    }
                }
                
                this.log('無可消除組，結束');
                break;
            }

            cascadeCount++;
            const cascade = {
                index: cascadeCount,
                matches: [],
                totalScore: 0,
                totalMatched: 0,
                matchCount: 0,
                boardBeforeEliminate: this.cloneBoardIfNeeded(board, false),  // 非必要，性能模式下跳過
                boardAfterEliminate: null,
                boardAfterGravity: null,  // 必要：game.js需要
                boardAfterFill: null      // 必要：game.js需要
            };

            this.log(`\n--- Cascade #${cascadeCount} ---`);

            // 處理所有消除組
            let hasWildInThisCascade = false;  // 追蹤整個cascade是否有Wild參與
            
            for (const match of matches) {
                const containsWild = match.positions.some(pos => pos.row === 3 && pos.col === 3);
                
                // 调试：输出match的位置信息
                if (containsWild) {
                    hasWildInThisCascade = true;
                    const posStr = match.positions.map(p => `[${p.row},${p.col}]`).join(' ');
                    console.log(`  包含Wild的消除组位置: ${posStr}`);
                }
                
                // 使用當前的wildEliminateCount計算分數（同一cascade內所有消除組用相同的wildCount）
                const score = this.calculateScore(match, script.wildEliminateCount);

                cascade.matches.push({
                    symbol: match.symbol,
                    count: match.positions.length,
                    positions: match.positions,
                    score: score,
                    containsWild: containsWild,
                    wildCountWhenCalculated: script.wildEliminateCount  // 記錄計算時的wild次數
                });

                cascade.totalScore += score;
                cascade.totalMatched += match.positions.length;
                cascade.matchCount++;
                
                const wildMult = containsWild ? this.getWildMultiplier(script.wildEliminateCount) : 1;
                const symbolName = this.symbolNames[match.symbol] || `符號${match.symbol}`;
                this.log(`消除: ${match.positions.length}個${symbolName}(#${match.symbol}), 分數:${score}${containsWild ? ` (含Wild, 倍數x${wildMult}, wildCount=${script.wildEliminateCount})` : ''}`);

                // 清除符號（保留Wild）
                for (const pos of match.positions) {
                    if (!(pos.row === 3 && pos.col === 3)) {
                        board[pos.row][pos.col] = null;
                    }
                }
            }
            
            // 【重要】整個cascade結束後，如果有Wild參與，wildCount只增加1次
            // 不管有多少個消除組包含Wild，都只+1
            if (hasWildInThisCascade) {
                const oldCount = script.wildEliminateCount;
                script.wildEliminateCount++;
                this.log(`cascade結束，Wild參與消除，wildEliminateCount: ${oldCount} → ${script.wildEliminateCount}`);
            }
            
            // 記錄此cascade結束後的wildEliminateCount（用於Game層同步顯示）
            cascade.wildEliminateCount = script.wildEliminateCount;

            script.totalScore += cascade.totalScore;
            cascade.boardAfterEliminate = this.cloneBoardIfNeeded(board, false);  // 非必要快照，性能模式下跳過

            // 更新Mega等級（當消除包含Wild時）
            const wildGroupCount = cascade.matches.filter(m => m.containsWild).length;
            if (wildGroupCount > 0 && script.megaEliminateCount < 3) {
                const increase = Math.min(wildGroupCount, 2); // 最多+2
                const oldMegaLevel = script.megaLevel;
                script.megaLevel = Math.min(script.megaLevel + increase, 2); // 上限2
                
                console.log(`Mega更新: ${wildGroupCount}個含Wild組 → +${increase} (${oldMegaLevel} → ${script.megaLevel})`);
                
                if (script.megaLevel === 2) {
                    script.megaEliminateCount++;
                    script.megaLevel = 0;
                    console.log(`✓ Mega循環完成！megaEliminateCount: ${script.megaEliminateCount}`);
                }
            }
            
            // 記錄當前cascade的mega狀態
            cascade.megaLevel = script.megaLevel;
            cascade.megaEliminateCount = script.megaEliminateCount;

            // 應用重力
            this.applyGravity(board);
            cascade.boardAfterGravity = this.cloneBoard(board);  // 保留快照確保邏輯一致

            // 【重要】每次fill時重新選擇dropSet（匹配Python邏輯）
            const currentDropSet = this.selectDropSet(cascadeCount);
            cascade.dropSet = currentDropSet;
            this.log(`Fill時選擇Drop Set: ${currentDropSet} (基於eliminate_count=${cascadeCount})`);
            
            // 填充新符號
            const dropResult = this.fillDropSymbols(board, currentDropSet, cascadeCount, isFreeGame);
            cascade.dropInfo = dropResult.dropInfo;
            cascade.boardAfterFill = this.cloneBoard(board);  // 保留快照確保邏輯一致
            cascade.dropMyTargets = dropResult.dropMyTargets;  // 記錄MY轉換
            
            // 顯示drop配置信息
            if (dropResult.dropInfo && dropResult.dropInfo.length > 0) {
                const dropInfoStr = dropResult.dropInfo
                    .map((info, row) => info ? `Row${row}: Set${info.dropSet}, Start=${info.startIdx}/${info.dropLen}, Fill=${info.fillCount}` : null)
                    .filter(x => x)
                    .join(', ');
                this.log(`Drop配置: ${dropInfoStr}`);
            }

            script.cascades.push(cascade);
        }

        this.log(`\n=== 腳本生成完成 ===`);
        console.log(`Spin分數: ${script.totalScore}`);  // 只顯示分數
        this.log(`總Cascade: ${script.cascades.length}`);
        this.log(`Wild消除次數: ${script.wildEliminateCount}`);
        this.log(`最終Mega狀態: Level=${script.megaLevel}, Count=${script.megaEliminateCount}`);

        return script;
    }
    
    // 生成完整的FreeGame腳本（包含多個spin直到結束）
    // ✅ 支持整场FreeGame重抽（根据总得分）
    generateFreeGameScript(initialSpins = 10, startWildCount = 0, bet = 1, enableRedraw = true, maxRedrawAttempts = 100) {
        let attempts = 0;
        let freeGameScript = null;
        
        // 重抽循环（整场FreeGame）
        while (attempts < maxRedrawAttempts) {
            attempts++;
            
            // 生成一场完整的FreeGame
            freeGameScript = this._generateSingleFreeGame(initialSpins, startWildCount, bet);
            
            // 检查是否需要重抽（使用freeredraw）
            if (enableRedraw && this.shouldRedraw(freeGameScript.totalScore, bet, true)) {
                this.log(`🔄 FreeGame重抽触发！(第${attempts}次尝试，总倍数${(freeGameScript.totalScore / bet).toFixed(2)}x)`);
                continue;  // 重新生成整场FreeGame
            }
            
            // 不需要重抽，跳出循环
            break;
        }
        
        if (attempts >= maxRedrawAttempts) {
            console.warn(`⚠️ FreeGame达到最大重抽次数(${maxRedrawAttempts})，使用最后一次结果`);
        }
        
        if (attempts > 1) {
            this.log(`✅ FreeGame重抽完成，共尝试${attempts}次整场FreeGame`);
        }
        
        // ✅ 记录FreeGame重抽次数
        freeGameScript.redrawAttempts = attempts;
        
        return freeGameScript;
    }
    
    // 内部函数：生成单场FreeGame（不含重抽逻辑）
    _generateSingleFreeGame(initialSpins = 10, startWildCount = 0, bet = 1) {
        // 啟用性能模式（關閉詳細日誌以加速生成）
        const wasPerformanceMode = this.performanceMode;
        this.performanceMode = true;
        
        const freeGameScript = {
            isFreeGame: true,
            initialSpins: initialSpins,
            totalSpins: 0,
            totalScore: 0,
            spins: [],  // 每個spin的腳本
            startWildCount: startWildCount,  // 開始時的Wild倍數
            endWildCount: 0,  // 結束時的Wild倍數
            totalRetriggers: 0  // 總觸發次數
        };
        
        this.log('\n=== FreeGame 場景腳本生成開始 ===');
        this.log(`初始spin數: ${initialSpins}`);
        this.log(`起始Wild倍數: ${startWildCount}`);
        
        let remainingSpins = initialSpins;
        let currentWildCount = startWildCount;
        let currentMegaLevel = 0;
        let currentMegaCount = 0;
        
        while (remainingSpins > 0) {
            const spinIndex = freeGameScript.spins.length + 1;
            console.log(`\n--- FreeGame Spin #${spinIndex} (剩餘: ${remainingSpins}, 當前wildCount: ${currentWildCount}) ---`);
            
            // 生成單次spin腳本（FreeGame中wildCount會累積）
            // ✅ 禁用单个spin的重抽（只在整场FreeGame层面重抽）
            const spinScript = this.generateSpinScript(currentMegaLevel, currentMegaCount, true, currentWildCount, bet, false);
            
            // 記錄wild倍數（從上次累積）
            spinScript.startWildCount = currentWildCount;
            
            // 計算結束時的wild倍數（此spin結束後的wildCount）
            spinScript.endWildCount = spinScript.wildEliminateCount;
            
            // 累積分數和狀態
            freeGameScript.totalScore += spinScript.totalScore;
            freeGameScript.spins.push(spinScript);
            freeGameScript.totalSpins++;
            
            // 更新累積狀態（wildCount已經是累積後的值）
            currentWildCount = spinScript.wildEliminateCount;
            currentMegaLevel = spinScript.megaLevel;
            currentMegaCount = spinScript.megaEliminateCount;
            
            // 減少剩餘spin
            remainingSpins--;
            
            // 檢查是否觸發Retrigger（檢查最後一個cascade的盤面）
            let finalBoard = spinScript.initialBoard;  // 預設為初始盤面
            if (spinScript.cascades.length > 0) {
                // 如果有cascade，使用最後一個cascade的fill後盤面
                const lastCascade = spinScript.cascades[spinScript.cascades.length - 1];
                
                // 優先使用 boardAfterFill，如果不存在則嘗試其他屬性
                if (lastCascade.boardAfterFill) {
                    finalBoard = lastCascade.boardAfterFill;
                } else if (lastCascade.boardAfterMega) {
                    // Mega 放置的 cascade 使用 boardAfterMega
                    finalBoard = lastCascade.boardAfterMega;
                } else if (lastCascade.boardAfterGravity) {
                    // 如果沒有 fill 但有 gravity，使用 boardAfterGravity
                    finalBoard = lastCascade.boardAfterGravity;
                } else {
                    // 最後的回退方案
                    this.log('警告：無法找到最終盤面，使用 initialBoard');
                }
            }
            
            const retrigger = this.checkRetrigger(finalBoard);
            spinScript.retrigger = retrigger;
            
            if (retrigger.triggered) {
                remainingSpins += retrigger.extraSpins;
                freeGameScript.totalRetriggers++;
                this.log(`✨ Retrigger! C1數量: ${retrigger.c1Count}, 獲得額外 ${retrigger.extraSpins} 次spin`);
                this.log(`剩餘spin: ${remainingSpins}`);
            }
        }
        
        freeGameScript.endWildCount = currentWildCount;
        
        // 恢復性能模式設置
        this.performanceMode = wasPerformanceMode;
        
        this.log('\n=== FreeGame 場景腳本生成完成 ===');
        console.log(`🎰 FreeGame總分數: ${freeGameScript.totalScore} (共${freeGameScript.totalSpins}次spin)`);  // 只顯示總分
        this.log(`觸發Retrigger次數: ${freeGameScript.totalRetriggers}`);
        this.log(`最終Wild倍數: ${freeGameScript.endWildCount}`);
        
        return freeGameScript;
    }

    // ==================== 工具函數 ====================

    cloneBoard(board) {
        return board.map(row => [...row]);
    }

    boardToString(board) {
        return board.map((row, i) => `Row${i}: [${row.join(',')}]`).join('\n');
    }
}
