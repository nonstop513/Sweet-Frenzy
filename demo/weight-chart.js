/**
 * 倍率權重分析圖表
 * 直接調整目標權重，自動反推重轉率
 */

let baseGameChart = null;
let freeGameChart = null;

// 工作副本
let workingBaseredraw = [];
let workingFreeredraw = [];

// 顯示範圍限制（到2000倍）
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

// 反推重轉率：根據目標權重計算需要的重轉率
// 公式推導：A[i] = B[i]*(1-R[i]) / Total
// => R[i] = 1 - (A[i] * S) / (B[i] * (1 - A[i]))
// 其中 S = Σ(B[j]*(1-R[j])) for j ≠ i
function calculateRedrawRateFromTarget(targetWeight, index, originalWeights, currentRedrawRates) {
    const B_i = originalWeights[index];

    if (B_i <= 0) return currentRedrawRates[index]; // 原始權重為0，無法調整
    if (targetWeight <= 0) return 1; // 目標為0，重轉率100%
    if (targetWeight >= 1) return 0; // 目標為100%，不可能

    // 計算其他區間的 S = Σ(B[j]*(1-R[j])) for j ≠ index
    let S = 0;
    for (let j = 0; j < originalWeights.length; j++) {
        if (j !== index) {
            const R_j = j < currentRedrawRates.length ? currentRedrawRates[j] : 0;
            S += originalWeights[j] * (1 - R_j);
        }
    }

    // R[i] = 1 - (A[i] * S) / (B[i] * (1 - A[i]))
    const numerator = targetWeight * S;
    const denominator = B_i * (1 - targetWeight);

    if (denominator <= 0) return 0;

    const R_i = 1 - (numerator / denominator);

    // 限制在 [0, 1] 範圍
    return Math.max(0, Math.min(1, R_i));
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
                    hidden: true
                },
                {
                    label: '目標權重 (可調整)',
                    data: [...displayAdjusted],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 5,
                    pointHoverRadius: 10,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: '重轉率 (自動計算)',
                    data: displayRedraw,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 3,
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
                    labels: { color: '#fff' }
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

                    // 只允許編輯目標權重（datasetIndex === 1）
                    if (datasetIndex === 1) {
                        showTargetWeightEditDialog(chartType, index);
                    }
                }
            }
        }
    });

    return chart;
}

// 顯示目標權重編輯對話框
function showTargetWeightEditDialog(chartType, index) {
    const multipleRange = data.multipleRange || [];
    const label = index < multipleRange.length ? multipleRange[index] : index;

    const originalWeights = chartType === 'base' ? data.baseredrawB : data.freeredrawB;
    const redrawRates = chartType === 'base' ? workingBaseredraw : workingFreeredraw;
    const adjustedWeights = calculateAdjustedWeights(originalWeights, redrawRates);

    const currentValue = adjustedWeights[index] || 0;

    const newValueStr = prompt(
        `調整 ${chartType === 'base' ? 'BaseGame' : 'FreeGame'} 倍數 ${label} 的目標權重\n` +
        `當前值: ${(currentValue * 100).toFixed(4)}%\n` +
        `請輸入新的目標權重 (0-100):`
    );

    if (newValueStr !== null && !isNaN(parseFloat(newValueStr))) {
        const targetWeight = Math.max(0, Math.min(100, parseFloat(newValueStr))) / 100;

        // 反推重轉率
        const newRedrawRate = calculateRedrawRateFromTarget(
            targetWeight,
            index,
            originalWeights,
            redrawRates
        );

        if (chartType === 'base') {
            workingBaseredraw[index] = newRedrawRate;
        } else {
            workingFreeredraw[index] = newRedrawRate;
        }

        console.log(`✅ 倍數 ${label}: 目標權重 ${(targetWeight*100).toFixed(4)}% → 重轉率 ${(newRedrawRate*100).toFixed(2)}%`);

        updateChartsWithWorkingData();
    }
}

// 使用工作數據更新圖表
function updateChartsWithWorkingData() {
    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];

    const adjustedBase = calculateAdjustedWeights(baseredrawB, workingBaseredraw);
    const adjustedFree = calculateAdjustedWeights(freeredrawB, workingFreeredraw);

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

    updateCycleDisplay(adjustedBase, adjustedFree);
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

// 根據目標週期調整
function adjustByTargetCycle() {
    const targetCycleInput = document.getElementById('targetCycleInput');
    const targetCycle = parseFloat(targetCycleInput.value);

    if (isNaN(targetCycle) || targetCycle <= 0) {
        alert('請輸入有效的目標週期（正數）');
        return;
    }

    const baseredrawB = data.baseredrawB || [];
    const lastIndex = baseredrawB.length - 1;

    // 目標觸發機率 = 1 / 目標週期
    const targetProb = 1 / targetCycle;

    // 使用反推公式計算所需的重轉率
    const newRedrawRate = calculateRedrawRateFromTarget(
        targetProb,
        lastIndex,
        baseredrawB,
        workingBaseredraw
    );

    if (newRedrawRate < 0 || newRedrawRate > 1) {
        alert(`無法達成目標週期 ${targetCycle}\n計算出的重轉率超出範圍`);
        return;
    }

    workingBaseredraw[lastIndex] = newRedrawRate;
    updateChartsWithWorkingData();

    console.log(`✅ 目標週期 ${targetCycle} → 重轉率 ${(newRedrawRate * 100).toFixed(2)}%`);
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
    // 重新從 data 讀取原始值（需要保存原始備份）
    workingBaseredraw = [...originalBaseredraw];
    workingFreeredraw = [...originalFreeredraw];
    updateChartsWithWorkingData();
    console.log('🔄 已重置為原始重轉率');
}

// 原始值備份
let originalBaseredraw = [];
let originalFreeredraw = [];

// 初始化圖表
function initWeightCharts() {
    // 備份原始值（只在第一次備份）
    if (originalBaseredraw.length === 0) {
        originalBaseredraw = [...(data.baseredraw || [])];
        originalFreeredraw = [...(data.freeredraw || [])];
    }

    // 複製到工作副本
    workingBaseredraw = [...(data.baseredraw || [])];
    workingFreeredraw = [...(data.freeredraw || [])];

    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];
    const multipleRange = data.multipleRange || [];

    const adjustedBase = calculateAdjustedWeights(baseredrawB, workingBaseredraw);
    const adjustedFree = calculateAdjustedWeights(freeredrawB, workingFreeredraw);

    const baseLabels = generateLabels(baseredrawB.length, multipleRange, DISPLAY_LIMIT);
    const freeLabels = generateLabels(freeredrawB.length, multipleRange, DISPLAY_LIMIT);

    if (baseGameChart) baseGameChart.destroy();
    if (freeGameChart) freeGameChart.destroy();

    baseGameChart = createInteractiveChart('baseGameChart', baseLabels, baseredrawB, adjustedBase, workingBaseredraw, 'base');
    freeGameChart = createInteractiveChart('freeGameChart', freeLabels, freeredrawB, adjustedFree, workingFreeredraw, 'free');

    updateCycleDisplay(adjustedBase, adjustedFree);
}

// 顯示/關閉彈窗
function showWeightModal() {
    document.getElementById('weightModal').style.display = 'flex';
    initWeightCharts();
}

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

    const adjustBtn = document.getElementById('adjustCycleBtn');
    if (adjustBtn) adjustBtn.addEventListener('click', adjustByTargetCycle);

    const resetBtn = document.getElementById('resetRedrawBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetToOriginal);
});
