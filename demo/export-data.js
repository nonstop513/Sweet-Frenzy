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
    if (!textarea) return;

    const text = textarea.value;
    const searchStr = `  "${key}":`;
    const charPos = text.indexOf(searchStr);
    if (charPos === -1) return;

    // 選取該行文字
    const lineEnd = text.indexOf('\n', charPos);
    const selEnd = lineEnd === -1 ? text.length : lineEnd;
    textarea.focus();
    textarea.setSelectionRange(charPos, selEnd);

    // 用 mirror div 精確計算 scrollTop
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
     'letterSpacing', 'wordSpacing', 'paddingTop', 'paddingLeft',
     'paddingRight', 'borderTopWidth', 'borderLeftWidth', 'whiteSpace',
     'wordWrap', 'wordBreak', 'width', 'boxSizing'].forEach(prop => {
        mirror.style[prop] = style[prop];
    });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';
    mirror.style.height = 'auto';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-all';

    // 放入目標位置之前的文字，量測高度
    mirror.textContent = text.substring(0, charPos);
    document.body.appendChild(mirror);
    const targetTop = mirror.scrollHeight;
    document.body.removeChild(mirror);

    // 置中顯示（向上偏移半個視窗高度）
    const viewHeight = textarea.clientHeight;
    textarea.scrollTop = Math.max(0, targetTop - viewHeight / 3);
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
