/**
 * export-data.js
 * 匯出原始遊戲參數（排除重轉率計算相關欄位）
 */

const EXCLUDE_KEYS = new Set([
    'baseredraw', 'freeredraw', 'multipleRange',
    'baseredrawB', 'freeredrawB',
    'basemultiple', 'freemultiple'
]);

function generateRawExportText() {
    const entries = Object.entries(data)
        .filter(([key]) => !EXCLUDE_KEYS.has(key));

    const lines = [];
    lines.push('{');

    entries.forEach(([key, val], i) => {
        const isLast = i === entries.length - 1;
        const json = JSON.stringify(val, null, 2)
            // 數字陣列壓成一行（若元素全為數字）
            .replace(/\[\s*([\d,.\s\-e]+)\s*\]/g, (_, inner) => {
                const flat = inner.replace(/\s+/g, ' ').trim();
                return `[ ${flat} ]`;
            });

        // indent 2 spaces
        const indented = json.split('\n').map((l, li) => li === 0 ? l : '  ' + l).join('\n');
        lines.push(`  "${key}": ${indented}${isLast ? '' : ','}`);
    });

    lines.push('}');
    return lines.join('\n');
}

function showExportModal() {
    const modal = document.getElementById('exportModal');
    const textarea = document.getElementById('exportText');
    if (!modal || !textarea) return;

    textarea.value = '生成中...';
    modal.style.display = 'flex';

    // 稍微延遲，讓 modal 先顯示再生成（資料量大時避免畫面卡頓）
    setTimeout(() => {
        textarea.value = generateRawExportText();
    }, 30);
}

function hideExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) exportBtn.addEventListener('click', showExportModal);

    const closeBtn = document.getElementById('closeExportModal');
    if (closeBtn) closeBtn.addEventListener('click', hideExportModal);

    const copyBtn = document.getElementById('copyExportBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            const textarea = document.getElementById('exportText');
            if (!textarea || textarea.value === '生成中...') return;
            textarea.select();
            navigator.clipboard.writeText(textarea.value).then(() => {
                copyBtn.classList.add('copied');
                copyBtn.textContent = '✓ 已複製';
                const feedback = document.getElementById('copyFeedback');
                const kb = (textarea.value.length / 1024).toFixed(1);
                if (feedback) feedback.textContent = `${kb} KB`;
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.textContent = '複製全部';
                    if (feedback) feedback.textContent = '';
                }, 2500);
            });
        });
    }
});
