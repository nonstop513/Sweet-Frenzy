/**
 * 倍率權重分析圖表
 * 按比例調整目標權重，自動反推重轉率
 * FreeGame 週期固定後，其餘權重按比例分配
 */

let baseGameChart = null;
let freeGameChart = null;

// 目標權重（直接操作）
let targetBaseWeights = [];
let targetFreeWeights = [];

// 原始值備份
let originalBaseredraw = [];
let originalFreeredraw = [];

// 顯示範圍限制（到2000倍）
const DISPLAY_LIMIT = 47;

// FreeGame 觸發索引（BaseGame 的第59個，index 58）
const TRIGGER_INDEX = 58;

// 編輯模式: 'input' 或 'drag'
let editMode = 'drag';

// 固定的 FreeGame 週期
let fixedCycle = 200;

// 拖拉狀態
let isDragging = false;
let dragChart = null;
let dragCanvas = null;
let dragIndex = -1;
let dragChartType = null;

// 全局滑鼠事件處理
document.addEventListener('mousemove', function(e) {
    if (!isDragging || !dragChart || !dragCanvas) return;

    const rect = dragCanvas.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const yAxis = dragChart.scales.y;
    const yValue = yAxis.getValueForPixel(y);
    const clampedValue = Math.max(0, Math.min(yAxis.max || 0.5, yValue));

    setTargetWeightProportional(dragChartType, dragIndex, clampedValue);
});

document.addEventListener('mouseup', function() {
    if (isDragging) {
        isDragging = false;
        if (dragCanvas) dragCanvas.style.cursor = 'default';
        dragChart = null;
        dragCanvas = null;
        dragIndex = -1;
        dragChartType = null;
    }
});

// 根據目標權重計算所需的重轉率
function calculateRedrawRates(originalWeights, targetWeights) {
    const redrawRates = [];

    for (let i = 0; i < originalWeights.length; i++) {
        const B = originalWeights[i];
        const A = targetWeights[i] || 0;

        if (B <= 0) {
            redrawRates.push(0);
        } else if (A <= 0) {
            redrawRates.push(1); // 100% 重轉
        } else {
            // A = B * (1 - R) / Total
            // 我們需要找到 R 使得所有 A 滿足
            // 這裡用近似方法：R = 1 - (A * Total) / B
            // 但 Total 也依賴於所有 R，所以需要迭代或直接計算

            // 直接計算法：
            // 設 Total = Σ(B[j] * (1 - R[j]))
            // A[i] = B[i] * (1 - R[i]) / Total
            // => B[i] * (1 - R[i]) = A[i] * Total
            // => 1 - R[i] = A[i] * Total / B[i]
            // => R[i] = 1 - A[i] * Total / B[i]

            // 計算 Total（基於目標權重）
            // 由於 Σ A[i] = 1，且 A[i] = B[i] * (1 - R[i]) / Total
            // => Total = Σ(B[i] * (1 - R[i]))

            // 簡化：直接用比例關係
            // 如果我們知道目標 A[i]，則 B[i] * (1 - R[i]) ∝ A[i]
            // 設 k = Total，則 B[i] * (1 - R[i]) = k * A[i]
            // => 1 - R[i] = k * A[i] / B[i]

            // 我們延後計算，先存 placeholder
            redrawRates.push(0);
        }
    }

    // 計算比例常數 k
    // Σ(B[i] * (1 - R[i])) = k * Σ(A[i]) = k * 1 = k
    // 所以 k = Total
    // 從 1 - R[i] = k * A[i] / B[i]
    // 且 Σ(B[i] * (1 - R[i])) = k
    // => Σ(B[i] * k * A[i] / B[i]) = k
    // => k * Σ(A[i]) = k
    // => k * 1 = k ✓ (恆成立)

    // 需要另一個條件：使用原始權重的總和
    // 設原始總和 S0 = Σ(B[i])
    // 目標調整後 Total = Σ(B[i] * (1 - R[i]))
    // 我們選擇 k 使得系統可解

    // 實際做法：迭代求解或使用約束
    // 這裡用直接法：R[i] = 1 - (A[i] / B[i]) * k
    // 選 k 使所有 R[i] 在 [0, 1]

    // 找到 k 的範圍
    let kMin = 0;
    let kMax = Infinity;

    for (let i = 0; i < originalWeights.length; i++) {
        const B = originalWeights[i];
        const A = targetWeights[i] || 0;
        if (B > 0 && A > 0) {
            // R[i] = 1 - k * A / B
            // 要 R[i] >= 0: k * A / B <= 1 => k <= B / A
            // 要 R[i] <= 1: k * A / B >= 0 => k >= 0
            kMax = Math.min(kMax, B / A);
        }
    }

    // 選擇 k（通常取最大值以最小化重轉率）
    const k = kMax * 0.9999; // 稍微小一點避免邊界問題

    for (let i = 0; i < originalWeights.length; i++) {
        const B = originalWeights[i];
        const A = targetWeights[i] || 0;
        if (B > 0 && A > 0) {
            redrawRates[i] = Math.max(0, Math.min(1, 1 - (k * A / B)));
        } else if (B > 0 && A <= 0) {
            redrawRates[i] = 1;
        } else {
            redrawRates[i] = 0;
        }
    }

    return redrawRates;
}

// 設定目標權重（按比例調整其他權重）
function setTargetWeightProportional(chartType, index, newWeight) {
    const isBase = chartType === 'base';
    const targetWeights = isBase ? targetBaseWeights : targetFreeWeights;
    const triggerWeight = isBase ? (1 / fixedCycle) : 0;

    // BaseGame: index 58 是觸發權重，不能直接調整（用週期控制）
    if (isBase && index === TRIGGER_INDEX) {
        return;
    }

    // 計算可分配的權重（扣除固定的觸發權重）
    const availableBudget = isBase ? (1 - triggerWeight) : 1;

    // 限制新權重不超過可用預算
    newWeight = Math.max(0, Math.min(availableBudget * 0.99, newWeight));

    // 計算其他權重的當前總和（不含 index 和觸發索引）
    let othersSum = 0;
    for (let i = 0; i < targetWeights.length; i++) {
        if (i !== index && !(isBase && i === TRIGGER_INDEX)) {
            othersSum += targetWeights[i];
        }
    }

    // 新的其他權重總和
    const newOthersSum = availableBudget - newWeight;

    // 按比例縮放其他權重
    const scale = othersSum > 0 ? (newOthersSum / othersSum) : 0;

    for (let i = 0; i < targetWeights.length; i++) {
        if (i === index) {
            targetWeights[i] = newWeight;
        } else if (isBase && i === TRIGGER_INDEX) {
            targetWeights[i] = triggerWeight; // 保持固定
        } else {
            targetWeights[i] = targetWeights[i] * scale;
        }
    }

    updateChartsFromTargetWeights();
}

// 從目標權重更新圖表
function updateChartsFromTargetWeights() {
    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];

    // 計算所需的重轉率
    const baseRedrawRates = calculateRedrawRates(baseredrawB, targetBaseWeights);
    const freeRedrawRates = calculateRedrawRates(freeredrawB, targetFreeWeights);

    // 更新圖表
    if (baseGameChart) {
        baseGameChart.data.datasets[1].data = targetBaseWeights.slice(0, DISPLAY_LIMIT);
        baseGameChart.data.datasets[2].data = baseRedrawRates.slice(0, DISPLAY_LIMIT);
        baseGameChart.update('none');
    }

    if (freeGameChart) {
        freeGameChart.data.datasets[1].data = targetFreeWeights.slice(0, DISPLAY_LIMIT);
        freeGameChart.data.datasets[2].data = freeRedrawRates.slice(0, DISPLAY_LIMIT);
        freeGameChart.update('none');
    }

    // 同步到遊戲引擎
    data.baseredraw = baseRedrawRates;
    data.freeredraw = freeRedrawRates;

    updateCycleDisplay();
}

// 初始化目標權重（從原始權重和重轉率計算）
function initTargetWeights() {
    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];
    const baseredraw = data.baseredraw || [];
    const freeredraw = data.freeredraw || [];

    // 計算調整後的權重作為初始目標
    targetBaseWeights = calculateAdjustedWeights(baseredrawB, baseredraw);
    targetFreeWeights = calculateAdjustedWeights(freeredrawB, freeredraw);

    // 讀取當前週期
    const triggerProb = targetBaseWeights[TRIGGER_INDEX] || 0.005;
    fixedCycle = triggerProb > 0 ? Math.round(1 / triggerProb) : 200;

    // 更新週期輸入框
    const cycleInput = document.getElementById('targetCycleInput');
    if (cycleInput) cycleInput.value = fixedCycle;
}

// 計算調整後的權重
function calculateAdjustedWeights(originalWeights, redrawRates) {
    const adjusted = [];
    let total = 0;

    for (let i = 0; i < originalWeights.length; i++) {
        const redrawRate = i < redrawRates.length ? redrawRates[i] : 0;
        const weight = originalWeights[i] * (1 - redrawRate);
        adjusted.push(weight);
        total += weight;
    }

    if (total > 0) {
        for (let i = 0; i < adjusted.length; i++) {
            adjusted[i] = adjusted[i] / total;
        }
    }

    return adjusted;
}

// 生成 X 軸標籤
function generateLabels(count, multipleRange, limit) {
    const labels = [];
    const displayCount = Math.min(count, limit);
    for (let i = 0; i < displayCount; i++) {
        if (multipleRange && i < multipleRange.length) {
            labels.push(i === 0 ? '0' : `${multipleRange[i]}`);
        } else {
            labels.push(`${i}`);
        }
    }
    return labels;
}

// 獲取Y軸最大值
function getYAxisMax() {
    const input = document.getElementById('yAxisMaxInput');
    const value = parseFloat(input?.value);
    return isNaN(value) || value <= 0 ? null : value / 100;
}

// 創建圖表
function createInteractiveChart(canvasId, labels, originalData, targetData, redrawData, chartType) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const displayOriginal = originalData.slice(0, DISPLAY_LIMIT);
    const displayTarget = targetData.slice(0, DISPLAY_LIMIT);
    const displayRedraw = redrawData.slice(0, DISPLAY_LIMIT);
    const yMax = getYAxisMax();

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '原始權重',
                    data: displayOriginal,
                    borderColor: 'rgba(255, 99, 132, 0.5)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 2,
                    hidden: true,
                    clip: false
                },
                {
                    label: '目標權重 (可調整)',
                    data: [...displayTarget],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    clip: false
                },
                {
                    label: '重轉率',
                    data: displayRedraw,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 3,
                    yAxisID: 'y1',
                    hidden: true,
                    clip: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 15,
                    bottom: 15,
                    left: 10,
                    right: 10
                }
            },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            if (context.datasetIndex === 2) {
                                return `${context.dataset.label}: ${(value * 100).toFixed(2)}%`;
                            }
                            return `${context.dataset.label}: ${(value * 100).toFixed(4)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: '倍數', color: '#fff' },
                    ticks: { color: '#aaa', maxRotation: 45, minRotation: 45 },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: '權重機率', color: '#fff' },
                    ticks: { color: '#aaa', callback: (v) => (v * 100).toFixed(1) + '%' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    min: 0,
                    max: yMax,
                    grace: '5%'  // 上下留白，避免數據點被切到
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: '重轉率', color: '#ffd700' },
                    ticks: { color: '#ffd700', callback: (v) => (v * 100).toFixed(0) + '%' },
                    grid: { drawOnChartArea: false },
                    min: 0,
                    max: 1
                }
            },
            onClick: function(evt, elements) {
                if (editMode !== 'input') return;
                if (elements.length > 0 && elements[0].datasetIndex === 1) {
                    showTargetWeightEditDialog(chartType, elements[0].index);
                }
            },
            onHover: function(evt, elements) {
                const canvas = evt.native.target;
                if (editMode === 'drag' && elements.length > 0 && elements[0].datasetIndex === 1) {
                    canvas.style.cursor = 'ns-resize';
                } else {
                    canvas.style.cursor = 'default';
                }
            }
        }
    });

    const canvas = document.getElementById(canvasId);
    bindDragEvents(canvas, chart, chartType);

    return chart;
}

// 綁定拖拉事件
function bindDragEvents(canvas, chart, chartType) {
    canvas.addEventListener('mousedown', function(e) {
        if (editMode !== 'drag') return;

        const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
        if (points.length > 0 && points[0].datasetIndex === 1) {
            isDragging = true;
            dragChart = chart;
            dragCanvas = canvas;
            dragIndex = points[0].index;
            dragChartType = chartType;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
}

// 顯示編輯對話框
function showTargetWeightEditDialog(chartType, index) {
    const multipleRange = data.multipleRange || [];
    const label = index < multipleRange.length ? multipleRange[index] : index;
    const targetWeights = chartType === 'base' ? targetBaseWeights : targetFreeWeights;
    const currentValue = targetWeights[index] || 0;

    const newValueStr = prompt(
        `調整 ${chartType === 'base' ? 'BaseGame' : 'FreeGame'} 倍數 ${label} 的目標權重\n` +
        `當前值: ${(currentValue * 100).toFixed(4)}%\n` +
        `請輸入新的目標權重 (%):`
    );

    if (newValueStr !== null && !isNaN(parseFloat(newValueStr))) {
        const newWeight = Math.max(0, parseFloat(newValueStr)) / 100;
        setTargetWeightProportional(chartType, index, newWeight);
    }
}

// 更新週期顯示
function updateCycleDisplay() {
    const triggerProb = targetBaseWeights[TRIGGER_INDEX] || 0;
    const cycle = triggerProb > 0 ? (1 / triggerProb) : Infinity;

    // 更新週期輸入框
    const cycleInput = document.getElementById('targetCycleInput');
    if (cycleInput && !cycleInput.matches(':focus')) {
        cycleInput.value = Math.round(cycle);
    }

    document.getElementById('originalTriggerProb').textContent =
        ((data.baseredrawB?.[TRIGGER_INDEX] || 0) * 100).toFixed(4) + '%';
    document.getElementById('adjustedTriggerProb').textContent =
        (triggerProb * 100).toFixed(4) + '%';

    // 更新平均倍數和RTP
    updateMultiplierDisplay();
}

// 計算並更新平均倍數和RTP顯示
function updateMultiplierDisplay() {
    const basemultiple = data.basemultiple || [];
    const freemultiple = data.freemultiple || [];

    // 計算 BaseGame 平均倍數 (不含觸發區間)
    let baseAvgMult = 0;
    let baseWeightSum = 0;
    for (let i = 0; i < targetBaseWeights.length; i++) {
        if (i < basemultiple.length) {
            baseAvgMult += targetBaseWeights[i] * basemultiple[i];
            baseWeightSum += targetBaseWeights[i];
        }
    }

    // 計算 FreeGame 平均倍數
    let freeAvgMult = 0;
    for (let i = 0; i < targetFreeWeights.length; i++) {
        if (i < freemultiple.length) {
            freeAvgMult += targetFreeWeights[i] * freemultiple[i];
        }
    }

    // FreeGame 觸發機率
    const triggerProb = targetBaseWeights[TRIGGER_INDEX] || 0;
    const cycle = triggerProb > 0 ? (1 / triggerProb) : 0;

    // BaseGame RTP = BaseGame平均倍數 (已包含 FreeGame 貢獻在權重分配中)
    // 簡化計算：直接顯示平均倍數作為RTP
    const baseRTP = baseAvgMult * 100;

    // FreeGame RTP = FreeGame平均倍數
    const freeRTP = freeAvgMult * 100;

    // 總 RTP = BaseGame直接分數 + FreeGame貢獻
    // BaseGame 不觸發時的平均倍數
    let baseDirectMult = 0;
    for (let i = 0; i < TRIGGER_INDEX; i++) {
        if (i < basemultiple.length && i < targetBaseWeights.length) {
            baseDirectMult += targetBaseWeights[i] * basemultiple[i];
        }
    }
    // 總 RTP = 直接分數 + 觸發機率 * FreeGame平均倍數
    const totalRTP = (baseDirectMult + triggerProb * freeAvgMult) * 100;

    // 更新顯示
    const baseTitle = document.getElementById('baseGameTitle');
    if (baseTitle) {
        baseTitle.innerHTML = `BaseGame 倍率權重 <span class="stats-inline">平均倍數: ${baseAvgMult.toFixed(2)}x | RTP: ${baseRTP.toFixed(2)}%</span>`;
    }

    const freeTitle = document.getElementById('freeGameTitle');
    if (freeTitle) {
        freeTitle.innerHTML = `FreeGame 倍率權重 <span class="stats-inline">平均倍數: ${freeAvgMult.toFixed(2)}x | RTP: ${freeRTP.toFixed(2)}%</span>`;
    }

    // 更新總 RTP
    const totalRTPEl = document.getElementById('totalRTP');
    if (totalRTPEl) {
        totalRTPEl.textContent = totalRTP.toFixed(2) + '%';
    }
}

// 週期輸入變化時即時更新
function onCycleInputChange() {
    const input = document.getElementById('targetCycleInput');
    const newCycle = parseFloat(input.value);

    if (isNaN(newCycle) || newCycle <= 0) return;

    fixedCycle = newCycle;
    const triggerProb = 1 / fixedCycle;

    // 重新分配權重
    const oldTriggerProb = targetBaseWeights[TRIGGER_INDEX] || 0;
    const oldOthersSum = 1 - oldTriggerProb;
    const newOthersSum = 1 - triggerProb;

    // 按比例縮放其他權重
    const scale = oldOthersSum > 0 ? (newOthersSum / oldOthersSum) : 1;

    for (let i = 0; i < targetBaseWeights.length; i++) {
        if (i === TRIGGER_INDEX) {
            targetBaseWeights[i] = triggerProb;
        } else {
            targetBaseWeights[i] *= scale;
        }
    }

    updateChartsFromTargetWeights();
}

// 設定目標週期（保留給按鈕用，現在改為即時更新）
function setTargetCycle() {
    onCycleInputChange();
    console.log(`✅ 週期設為 ${fixedCycle}，觸發機率 ${(1/fixedCycle * 100).toFixed(4)}%`);
}

// 更新Y軸範圍
function updateYAxisScale() {
    const yMax = getYAxisMax();
    if (baseGameChart) {
        baseGameChart.options.scales.y.max = yMax;
        baseGameChart.update();
    }
    if (freeGameChart) {
        freeGameChart.options.scales.y.max = yMax;
        freeGameChart.update();
    }
}

// 切換編輯模式
function toggleEditMode() {
    editMode = editMode === 'input' ? 'drag' : 'input';
    updateModeDisplay();
}

function updateModeDisplay() {
    const modeBtn = document.getElementById('editModeBtn');
    const modeText = document.getElementById('editModeText');
    if (modeBtn) {
        modeBtn.textContent = editMode === 'drag' ? '拖拉模式' : '輸入模式';
        modeBtn.className = editMode === 'drag' ? 'btn-mode drag-mode' : 'btn-mode input-mode';
    }
    if (modeText) {
        modeText.textContent = editMode === 'drag' ? '上下拖拉數據點調整' : '點擊數據點輸入數值';
    }
}

// 重置
function resetToOriginal() {
    if (originalBaseredraw.length > 0) {
        data.baseredraw = [...originalBaseredraw];
        data.freeredraw = [...originalFreeredraw];
    }
    initTargetWeights();
    initWeightCharts();
    console.log('🔄 已重置');
}

// 初始化圖表
function initWeightCharts() {
    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];
    const multipleRange = data.multipleRange || [];

    const baseLabels = generateLabels(baseredrawB.length, multipleRange, DISPLAY_LIMIT);
    const freeLabels = generateLabels(freeredrawB.length, multipleRange, DISPLAY_LIMIT);

    const baseRedrawRates = calculateRedrawRates(baseredrawB, targetBaseWeights);
    const freeRedrawRates = calculateRedrawRates(freeredrawB, targetFreeWeights);

    if (baseGameChart) baseGameChart.destroy();
    if (freeGameChart) freeGameChart.destroy();

    baseGameChart = createInteractiveChart('baseGameChart', baseLabels, baseredrawB, targetBaseWeights, baseRedrawRates, 'base');
    freeGameChart = createInteractiveChart('freeGameChart', freeLabels, freeredrawB, targetFreeWeights, freeRedrawRates, 'free');

    updateCycleDisplay();
    updateModeDisplay();
}

// 顯示/關閉彈窗
function showWeightModal() {
    document.getElementById('weightModal').style.display = 'flex';
    initTargetWeights();
    initWeightCharts();
}

function hideWeightModal() {
    document.getElementById('weightModal').style.display = 'none';
}

// 綁定事件
document.addEventListener('DOMContentLoaded', function() {
    // 備份原始值
    originalBaseredraw = [...(data.baseredraw || [])];
    originalFreeredraw = [...(data.freeredraw || [])];

    document.getElementById('weightChartBtn').addEventListener('click', showWeightModal);
    document.getElementById('closeModal').addEventListener('click', hideWeightModal);
    // 移除點擊背景關閉，只能點叉叉關閉

    const adjustBtn = document.getElementById('adjustCycleBtn');
    if (adjustBtn) adjustBtn.addEventListener('click', setTargetCycle);

    // 週期輸入即時更新
    const cycleInput = document.getElementById('targetCycleInput');
    if (cycleInput) {
        cycleInput.addEventListener('input', onCycleInputChange);
        cycleInput.addEventListener('change', onCycleInputChange);
    }

    const resetBtn = document.getElementById('resetRedrawBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetToOriginal);

    const modeBtn = document.getElementById('editModeBtn');
    if (modeBtn) modeBtn.addEventListener('click', toggleEditMode);

    const yAxisInput = document.getElementById('yAxisMaxInput');
    if (yAxisInput) yAxisInput.addEventListener('change', updateYAxisScale);
});
