/**
 * 倍率權重分析圖表
 * 顯示 BaseGame 和 FreeGame 經重轉後的倍率權重分佈
 */

let baseGameChart = null;
let freeGameChart = null;

// 計算重轉後的權重
// 公式: adjustedWeight[i] = originalWeight[i] * (1 - redrawRate[i]) / sum(originalWeight[j] * (1 - redrawRate[j]))
function calculateAdjustedWeights(originalWeights, redrawRates) {
    const adjusted = [];
    let total = 0;

    // 計算每個區間的調整後權重（未歸一化）
    for (let i = 0; i < originalWeights.length; i++) {
        const redrawRate = i < redrawRates.length ? redrawRates[i] : 0;
        const weight = originalWeights[i] * (1 - redrawRate);
        adjusted.push(weight);
        total += weight;
    }

    // 歸一化
    if (total > 0) {
        for (let i = 0; i < adjusted.length; i++) {
            adjusted[i] = adjusted[i] / total;
        }
    }

    return adjusted;
}

// 生成 X 軸標籤（倍數區間）
function generateLabels(count, multipleRange) {
    const labels = [];
    for (let i = 0; i < count; i++) {
        if (multipleRange && i < multipleRange.length) {
            if (i === 0) {
                labels.push('0');
            } else {
                labels.push(`≤${multipleRange[i]}`);
            }
        } else {
            labels.push(`${i}`);
        }
    }
    return labels;
}

// 創建圖表
function createChart(canvasId, labels, originalData, adjustedData, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '原始權重',
                    data: originalData,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 2
                },
                {
                    label: '重轉後權重',
                    data: adjustedData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    labels: {
                        color: '#fff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            return `${context.dataset.label}: ${(value * 100).toFixed(4)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '倍數區間',
                        color: '#fff'
                    },
                    ticks: {
                        color: '#aaa',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '機率',
                        color: '#fff'
                    },
                    ticks: {
                        color: '#aaa',
                        callback: function(value) {
                            return (value * 100).toFixed(2) + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)'
                    }
                }
            }
        }
    });
}

// 更新圖表和數據
function updateWeightCharts() {
    // 獲取數據
    const baseredrawB = data.baseredrawB || [];
    const freeredrawB = data.freeredrawB || [];
    const baseredraw = data.baseredraw || [];
    const freeredraw = data.freeredraw || [];
    const multipleRange = data.multipleRange || [];

    // 計算調整後的權重
    const adjustedBase = calculateAdjustedWeights(baseredrawB, baseredraw);
    const adjustedFree = calculateAdjustedWeights(freeredrawB, freeredraw);

    // 生成標籤
    const baseLabels = generateLabels(baseredrawB.length, multipleRange);
    const freeLabels = generateLabels(freeredrawB.length, multipleRange);

    // 銷毀舊圖表
    if (baseGameChart) {
        baseGameChart.destroy();
    }
    if (freeGameChart) {
        freeGameChart.destroy();
    }

    // 創建新圖表
    baseGameChart = createChart('baseGameChart', baseLabels, baseredrawB, adjustedBase, 'BaseGame');
    freeGameChart = createChart('freeGameChart', freeLabels, freeredrawB, adjustedFree, 'FreeGame');

    // 計算 FreeGame 週期
    // baseredrawB 的最後一個值是 FreeGame 觸發機率（C1 >= 3 的情況）
    const originalTriggerProb = baseredrawB[baseredrawB.length - 1] || 0;
    const adjustedTriggerProb = adjustedBase[adjustedBase.length - 1] || 0;
    const freeGameCycle = adjustedTriggerProb > 0 ? (1 / adjustedTriggerProb) : Infinity;

    // 更新顯示
    document.getElementById('originalTriggerProb').textContent =
        (originalTriggerProb * 100).toFixed(4) + '%';
    document.getElementById('adjustedTriggerProb').textContent =
        (adjustedTriggerProb * 100).toFixed(4) + '%';
    document.getElementById('freeGameCycle').textContent =
        freeGameCycle === Infinity ? '∞' : freeGameCycle.toFixed(2);
}

// 顯示彈窗
function showWeightModal() {
    document.getElementById('weightModal').style.display = 'flex';
    updateWeightCharts();
}

// 關閉彈窗
function hideWeightModal() {
    document.getElementById('weightModal').style.display = 'none';
}

// 綁定事件
document.addEventListener('DOMContentLoaded', function() {
    // 按鈕點擊
    document.getElementById('weightChartBtn').addEventListener('click', showWeightModal);

    // 關閉按鈕
    document.getElementById('closeModal').addEventListener('click', hideWeightModal);

    // 點擊背景關閉
    document.getElementById('weightModal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideWeightModal();
        }
    });

    // ESC 鍵關閉
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideWeightModal();
        }
    });
});
