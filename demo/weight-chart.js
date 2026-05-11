/**
 * 倍率權重分析圖表
 * 顯示 BaseGame 和 FreeGame 經重轉後的倍率權重分佈
 * 支援互動式調整
 */

let baseGameChart = null;
let freeGameChart = null;

// 工作副本（可修改）
let workingBaseredraw = [];
let workingFreeredraw = [];

// 顯示範圍限制（到2000倍，約 index 46）
const DISPLAY_LIMIT = 47;

// 計算重轉後的權重
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
            if (i === 0) {
                labels.push('0');
            } else {
                labels.push(`${multipleRange[i]}`);
            }
        } else {
            labels.push(`${i}`);
        }
    }
    return labels;
}

// 創建可互動的圖表
function createInteractiveChart(canvasId, labels, originalData, adjustedData, redrawData, chartType) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const displayOriginal = originalData.slice(0, DISPLAY_LIMIT);
    const displayAdjusted = adjustedData.slice(0, DISPLAY_LIMIT);
    const displayRedraw = redrawData.slice(0, DISPLAY_LIMIT);

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
                    hidden: true  // 預設隱藏
                },
                {
                    label: '重轉後權重',
                    data: displayAdjusted,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 8
                },
                {
                    label: '重轉率',
                    data: displayRedraw,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 8,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#fff' },
                    onClick: function(e, legendItem, legend) {
                        // 預設行為：點擊切換顯示/隱藏
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        const meta = ci.getDatasetMeta(index);
                        meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                        ci.update();
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            if (context.datasetIndex === 2) {
                                return `${context.dataset.label}: ${(value * 100).toFixed(2)}%`;
                            }
                            return `${context.dataset.label}: ${(value * 100).toFixed(6)}%`;
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
                    ticks: {
                        color: '#aaa',
                        callback: (v) => (v * 100).toFixed(2) + '%'
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: '重轉率', color: '#ffd700' },
                    ticks: {
                        color: '#ffd700',
                        callback: (v) => (v * 100).toFixed(0) + '%'
                    },
                    grid: { drawOnChartArea: false },
                    min: 0,
                    max: 1
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    const element = elements[0];
                    const datasetIndex = element.datasetIndex;
                    const index = element.index;

                    // 只允許編輯重轉率（datasetIndex === 2）
                    if (datasetIndex === 2) {
                        showEditDialog(chartType, index, displayRedraw[index]);
                    }
                }
            }
        }
    });

    return chart;
}

// 顯示編輯對話框
function showEditDialog(chartType, index, currentValue) {
    const multipleRange = data.multipleRange || [];
    const label = index < multipleRange.length ? multipleRange[index] : index;

    const newValue = prompt(
        `調整 ${chartType} 倍數 ${label} 的重轉率\n` +
        `當前值: ${(currentValue * 100).toFixed(2)}%\n` +
        `請輸入新的重轉率 (0-100):`
    );

    if (newValue !== null && !isNaN(parseFloat(newValue))) {
        const rate = Math.max(0, Math.min(100, parseFloat(newValue))) / 100;

        if (chartType === 'base') {
            workingBaseredraw[index] = rate;
        } else {
            workingFreeredraw[index] = rate;
        }

        updateChartsWithWorkingData();
    }
}

// 使用工作數據更新圖表
function updateChartsWithWorkingData() {
    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];
    const multipleRange = data.multipleRange || [];

    // 計算調整後的權重
    const adjustedBase = calculateAdjustedWeights(baseredrawB, workingBaseredraw);
    const adjustedFree = calculateAdjustedWeights(freeredrawB, workingFreeredraw);

    // 更新圖表數據
    if (baseGameChart) {
        baseGameChart.data.datasets[1].data = adjustedBase.slice(0, DISPLAY_LIMIT);
        baseGameChart.data.datasets[2].data = workingBaseredraw.slice(0, DISPLAY_LIMIT);
        baseGameChart.update();
    }

    if (freeGameChart) {
        freeGameChart.data.datasets[1].data = adjustedFree.slice(0, DISPLAY_LIMIT);
        freeGameChart.data.datasets[2].data = workingFreeredraw.slice(0, DISPLAY_LIMIT);
        freeGameChart.update();
    }

    // 更新週期顯示
    updateCycleDisplay(adjustedBase, adjustedFree);

    // 同步到遊戲引擎
    syncToGameEngine();
}

// 更新週期顯示
function updateCycleDisplay(adjustedBase, adjustedFree) {
    const baseredrawB = data.baseredrawB || [];
    const originalTriggerProb = baseredrawB[baseredrawB.length - 1] || 0;
    const adjustedTriggerProb = adjustedBase[adjustedBase.length - 1] || 0;
    const freeGameCycle = adjustedTriggerProb > 0 ? (1 / adjustedTriggerProb) : Infinity;

    document.getElementById('originalTriggerProb').textContent =
        (originalTriggerProb * 100).toFixed(4) + '%';
    document.getElementById('adjustedTriggerProb').textContent =
        (adjustedTriggerProb * 100).toFixed(4) + '%';
    document.getElementById('freeGameCycle').textContent =
        freeGameCycle === Infinity ? '∞' : freeGameCycle.toFixed(2);
}

// 根據目標週期反推重轉率
function adjustByTargetCycle() {
    const targetCycleInput = document.getElementById('targetCycleInput');
    const targetCycle = parseFloat(targetCycleInput.value);

    if (isNaN(targetCycle) || targetCycle <= 0) {
        alert('請輸入有效的目標週期（正數）');
        return;
    }

    const baseredrawB = data.baseredrawB || [];
    const lastIndex = baseredrawB.length - 1;
    const originalProb = baseredrawB[lastIndex];

    // 目標觸發機率 = 1 / 目標週期
    const targetProb = 1 / targetCycle;

    // 計算需要的重轉率
    // adjustedProb = originalProb * (1 - redrawRate) / totalAdjusted
    // 簡化假設：只調整最後一個區間的重轉率
    // 需要反推 redrawRate[lastIndex]

    // 先計算其他區間的總調整權重
    let otherTotal = 0;
    for (let i = 0; i < lastIndex; i++) {
        const redrawRate = workingBaseredraw[i] || 0;
        otherTotal += baseredrawB[i] * (1 - redrawRate);
    }

    // targetProb = originalProb * (1 - newRate) / (otherTotal + originalProb * (1 - newRate))
    // 解方程得: newRate = 1 - (targetProb * otherTotal) / (originalProb * (1 - targetProb))

    if (targetProb >= 1) {
        alert('目標週期過小，無法達成');
        return;
    }

    const numerator = targetProb * otherTotal;
    const denominator = originalProb * (1 - targetProb);
    const newRate = 1 - (numerator / denominator);

    if (newRate < 0 || newRate > 1) {
        alert(`計算出的重轉率 ${(newRate * 100).toFixed(2)}% 超出範圍 [0, 100]%\n請調整目標週期`);
        return;
    }

    workingBaseredraw[lastIndex] = newRate;
    updateChartsWithWorkingData();

    console.log(`✅ 已調整 index ${lastIndex} 的重轉率為 ${(newRate * 100).toFixed(2)}%`);
}

// 同步到遊戲引擎
function syncToGameEngine() {
    if (typeof data !== 'undefined') {
        data.baseredraw = [...workingBaseredraw];
        data.freeredraw = [...workingFreeredraw];
        console.log('✅ 重轉率已同步到遊戲引擎');
    }
}

// 重置為原始值
function resetToOriginal() {
    workingBaseredraw = [...(data.baseredraw || [])];
    workingFreeredraw = [...(data.freeredraw || [])];
    updateChartsWithWorkingData();
    console.log('🔄 已重置為原始重轉率');
}

// 初始化圖表
function initWeightCharts() {
    // 複製原始數據到工作副本
    workingBaseredraw = [...(data.baseredraw || [])];
    workingFreeredraw = [...(data.freeredraw || [])];

    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];
    const multipleRange = data.multipleRange || [];

    // 計算調整後的權重
    const adjustedBase = calculateAdjustedWeights(baseredrawB, workingBaseredraw);
    const adjustedFree = calculateAdjustedWeights(freeredrawB, workingFreeredraw);

    // 生成標籤
    const baseLabels = generateLabels(baseredrawB.length, multipleRange, DISPLAY_LIMIT);
    const freeLabels = generateLabels(freeredrawB.length, multipleRange, DISPLAY_LIMIT);

    // 銷毀舊圖表
    if (baseGameChart) baseGameChart.destroy();
    if (freeGameChart) freeGameChart.destroy();

    // 創建新圖表
    baseGameChart = createInteractiveChart('baseGameChart', baseLabels, baseredrawB, adjustedBase, workingBaseredraw, 'base');
    freeGameChart = createInteractiveChart('freeGameChart', freeLabels, freeredrawB, adjustedFree, workingFreeredraw, 'free');

    // 更新週期顯示
    updateCycleDisplay(adjustedBase, adjustedFree);
}

// 顯示彈窗
function showWeightModal() {
    document.getElementById('weightModal').style.display = 'flex';
    initWeightCharts();
}

// 關閉彈窗
function hideWeightModal() {
    document.getElementById('weightModal').style.display = 'none';
}

// 綁定事件
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('weightChartBtn').addEventListener('click', showWeightModal);
    document.getElementById('closeModal').addEventListener('click', hideWeightModal);
    document.getElementById('weightModal').addEventListener('click', function(e) {
        if (e.target === this) hideWeightModal();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') hideWeightModal();
    });

    // 週期調整按鈕
    const adjustBtn = document.getElementById('adjustCycleBtn');
    if (adjustBtn) {
        adjustBtn.addEventListener('click', adjustByTargetCycle);
    }

    // 重置按鈕
    const resetBtn = document.getElementById('resetRedrawBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetToOriginal);
    }
});
