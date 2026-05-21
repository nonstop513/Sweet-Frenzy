/**
 * export-data.js
 * 匯出原始遊戲參數（排除重轉率計算相關欄位）
 */

const EXCLUDE_KEYS = new Set([
    'baseredraw', 'freeredraw', 'multipleRange',
    'baseredrawB', 'freeredrawB',
    'basemultiple', 'freemultiple'
]);

// 記錄每個 key 在文字中的行號（從 0 起算）
let keyLineMap = {};

function generateRawExportText() {
    keyLineMap = {};
    const entries = Object.entries(data)
        .filter(([key]) => !EXCLUDE_KEYS.has(key));

    const parts = ['{'];
    let currentLine = 1; // '{' 佔第 0 行，現在從第 1 行開始

    entries.forEach(([key, val], i) => {
        const isLast = i === entries.length - 1;
        const json = JSON.stringify(val, null, 2)
            // 數字陣列壓成一行
            .replace(/\[\s*([\d,.\s\-e]+)\s*\]/g, (_, inner) => {
                const flat = inner.replace(/\s+/g, ' ').trim();
                return `[ ${flat} ]`;
            });

        const indented = json.split('\n').map((l, li) => li === 0 ? l : '  ' + l).join('\n');
        const block = `  "${key}": ${indented}${isLast ? '' : ','}`;

        // 記錄此 key 在最終文字中的實際行號
        keyLineMap[key] = currentLine;

        parts.push(block);

        // 計算這個 block 佔了幾行
        currentLine += (block.match(/\n/g) || []).length + 1;
    });

    parts.push('}');
    return parts.join('\n');
}

function populateJumpSelect(keys) {
    const select = document.getElementById('exportJumpSelect');
    if (!select) return;
    select.innerHTML = '<option value="">— 跳至參數 —</option>';
    keys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key;
        select.appendChild(opt);
    });
}

function scrollTextareaToKey(key) {
    const textarea = document.getElementById('exportText');
    if (!textarea || !(key in keyLineMap)) return;

    const lineNum = keyLineMap[key];
    const text = textarea.value;
    const lines = text.split('\n');

    // 計算目標行的字元偏移量
    let charOffset = 0;
    for (let i = 0; i < lineNum && i < lines.length; i++) {
        charOffset += lines[i].length + 1; // +1 for \n
    }

    // 用隱藏的 clone 量測行高並計算 scrollTop
    const lineHeight = getTextareaLineHeight(textarea);
    textarea.scrollTop = Math.max(0, (lineNum - 2) * lineHeight);

    // 同時把游標移到該行讓使用者看到 highlight
    textarea.focus();
    textarea.setSelectionRange(charOffset, charOffset + (lines[lineNum] ? lines[lineNum].length : 0));
}

function getTextareaLineHeight(textarea) {
    // 從計算樣式取得行高
    const style = window.getComputedStyle(textarea);
    const lh = parseFloat(style.lineHeight);
    if (!isNaN(lh)) return lh;
    // fallback: fontSize * 1.5
    return parseFloat(style.fontSize) * 1.5;
}

function showExportModal() {
    const modal = document.getElementById('exportModal');
    const textarea = document.getElementById('exportText');
    if (!modal || !textarea) return;

    textarea.value = '生成中...';
    modal.style.display = 'flex';

    setTimeout(() => {
        textarea.value = generateRawExportText();
        const exportedKeys = Object.keys(keyLineMap);
        populateJumpSelect(exportedKeys);
        // 重置下拉選單
        const sel = document.getElementById('exportJumpSelect');
        if (sel) sel.value = '';
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

    const jumpSelect = document.getElementById('exportJumpSelect');
    if (jumpSelect) {
        jumpSelect.addEventListener('change', function () {
            if (this.value) scrollTextareaToKey(this.value);
        });
    }

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
