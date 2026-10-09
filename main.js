// ==UserScript==
// @name         CodeHS Ghost Typer (Clean Edition)
// @namespace    local.autotyper
// @version      3.3
// @description  Non-student mode on codehs.com/sandbox/id and /share/; student mode (auto-closed brackets skipped with Arrow Right) everywhere else.
// @match        *://codehs.com/*
// @match        *://*.codehs.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Safety net in case the @match rules are ever loosened.
    if (location.hostname !== 'codehs.com' && !location.hostname.endsWith('.codehs.com')) return;

    let lastTarget = null;
    let dismissTimeout = null;
    let isTyping = false;
    let isPaused = false;
    let pauseResolver = null;

    const workerBlob = new Blob([`
        let timer = null;
        onmessage = (e) => {
            if (e.data.action === 'wait') {
                timer = setTimeout(() => postMessage('done'), e.data.ms);
            } else if (e.data.action === 'cancel') {
                clearTimeout(timer);
            }
        };
    `], { type: 'application/javascript' });
    const timerWorker = new Worker(URL.createObjectURL(workerBlob));

    const wait = (ms) => new Promise(resolve => {
        timerWorker.onmessage = () => resolve();
        timerWorker.postMessage({ action: 'wait', ms });
    });

    const KEY_NEIGHBORS = {
        'a': ['q','w','s','z'], 'b': ['v','g','h','n'], 'c': ['x','d','f','v'],
        'd': ['s','e','r','f','c','x'], 'e': ['w','s','d','r'], 'f': ['d','r','t','g','v','c'],
        'g': ['f','t','y','h','b','v'], 'h': ['g','y','u','j','n','b'], 'i': ['u','j','k','o'],
        'j': ['h','u','i','k','m','n'], 'k': ['j','i','o','l','m'], 'l': ['k','o','p'],
        'm': ['n','j','k'], 'n': ['b','h','j','m'], 'o': ['i','k','l','p'],
        'p': ['o','l'], 'q': ['1','w','a'], 'r': ['e','d','f','t'], 's': ['a','w','e','d','x','z'],
        't': ['r','f','g','y'], 'u': ['y','h','j','i'], 'v': ['c','f','g','b'],
        'w': ['q','a','s','e'], 'x': ['z','s','d','c'], 'y': ['t','g','h','u'],
        'z': ['a','s','x']
    };

    const style = document.createElement('style');
    style.textContent = `
        #at-toast { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; background: #18181b; color: #f4f4f5; border: 1px solid #3f3f46; padding: 10px 14px; border-radius: 8px; font-family: -apple-system, sans-serif; font-size: 13px; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); transition: opacity 0.25s; }
        #at-toast button { background: #2563eb; color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; font-weight: 500; }
        #at-toast button.dismiss { background: transparent; color: #a1a1aa; padding: 4px; }
        #at-toast button:hover { opacity: 0.9; }

        #at-modal { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; width: 380px; background: #18181b; color: #f4f4f5; border: 1px solid #3f3f46; border-radius: 10px; font-family: -apple-system, sans-serif; font-size: 13px; padding: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.7); display: none; }
        #at-modal textarea { width: 100%; height: 90px; background: #09090b; border: 1px solid #27272a; color: #f4f4f5; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 12px; resize: vertical; box-sizing: border-box; margin-bottom: 12px; }
        .at-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .at-row label { font-size: 12px; color: #a1a1aa; flex: 1; }
        .at-row .at-val { font-size: 12px; font-variant-numeric: tabular-nums; min-width: 30px; text-align: right; }
        .at-row input[type="range"] { width: 120px; accent-color: #2563eb; margin: 0 10px; }
        .at-num { width: 45px; background: #09090b; border: 1px solid #3f3f46; color: #fff; border-radius: 4px; text-align: center; font-size: 12px; padding: 2px; }
        .at-toggles { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; padding: 8px 0; border-top: 1px solid #27272a; border-bottom: 1px solid #27272a; }
        .at-toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
        .at-toggle input { accent-color: #2563eb; cursor: pointer; }
        .at-actions { display: flex; gap: 8px; margin-top: 12px; }
        .at-actions button { flex: 1; padding: 8px; border-radius: 6px; border: none; font-weight: 500; cursor: pointer; transition: 0.1s; }
        .at-actions button:hover:not(:disabled) { filter: brightness(1.1); }
        .at-actions button:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary { background: #2563eb; color: #fff; }
        .btn-secondary { background: #27272a; color: #a1a1aa; }
        .btn-warning { background: #d97706; color: #fff; }
        .btn-danger { background: #dc2626; color: #fff; }

        #at-active-view { display: none; flex-direction: column; gap: 12px; }
        .at-progress-container { width: 100%; height: 8px; background: #27272a; border-radius: 4px; overflow: hidden; }
        #at-progress-bar { height: 100%; background: #2563eb; width: 0%; transition: width 0.2s; }
        #at-status-text { font-size: 13px; font-weight: 500; text-align: center; color: #3b82f6; }
        #at-status-sub { font-size: 11px; color: #a1a1aa; text-align: center; margin-top: -8px; }
    `;
    document.head.appendChild(style);

    const toast = document.createElement('div');
    toast.id = 'at-toast';
    toast.style.display = 'none';
    toast.innerHTML = `<span>CodeHS text input detected. Stream code?</span><button id="at-btn-yes">Yes</button><button class="dismiss" id="at-btn-no">✕</button>`;
    document.body.appendChild(toast);

    const modal = document.createElement('div');
    modal.id = 'at-modal';
    modal.innerHTML = `
        <div id="at-setup-view">
            <div id="at-mode" style="font-size:11px;color:#a1a1aa;margin-bottom:8px;"></div>
            <textarea id="at-input" placeholder="Paste source code here..."></textarea>
            <div class="at-row"><label>Speed (WPM)</label><input type="range" id="at-wpm" min="20" max="220" value="85"><span class="at-val" id="at-wpm-val">85</span></div>
            <div class="at-row" id="row-errors"><label>Error Rate</label><input type="range" id="at-err" min="0" max="15" value="3"><span class="at-val" id="at-err-val">3%</span></div>
            <div class="at-row" id="row-consistency"><label>Consistency</label><input type="range" id="at-con" min="10" max="100" value="80"><span class="at-val" id="at-con-val">80%</span></div>
            <div class="at-row" id="row-breaks"><label>Break Chance</label><input type="range" id="at-brk-pct" min="0" max="15" value="4"><span class="at-val" id="at-brk-pct-val">4%</span></div>
            <div class="at-row" id="row-break-time"><label>Break Duration</label><div><input type="number" id="at-brk-min" min="1" max="120" value="2" class="at-num"> <span style="color: #a1a1aa;">to</span> <input type="number" id="at-brk-max" min="2" max="120" value="7" class="at-num"></div></div>
            <div class="at-toggles">
                <label class="at-toggle"><input type="checkbox" id="at-chk-human" checked> Humanized (Typos, Rhythm, Breaks)</label>
                <label class="at-toggle"><input type="checkbox" id="at-chk-fast"> Fast Mode (600 WPM Cap)</label>
                <label class="at-toggle"><input type="checkbox" id="at-chk-fmt" checked> Strip indentation (IDE auto-indents)</label>
            </div>
            <div class="at-actions">
                <button id="at-start" class="btn-primary">Start Typing</button>
                <button id="at-cancel-setup" class="btn-secondary">Dismiss</button>
            </div>
        </div>
        <div id="at-active-view">
            <div id="at-status-text">Typing...</div>
            <div class="at-progress-container"><div id="at-progress-bar"></div></div>
            <div id="at-status-sub">0 / 0 characters</div>
            <div class="at-actions">
                <button id="at-pause" class="btn-warning">Pause</button>
                <button id="at-cancel-active" class="btn-danger">Stop & Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const setupView = modal.querySelector('#at-setup-view');
    const activeView = modal.querySelector('#at-active-view');
    const [wpmSlider, errSlider, conSlider, brkPctSlider] = ['#at-wpm', '#at-err', '#at-con', '#at-brk-pct'].map(id => modal.querySelector(id));
    const [chkHuman, chkFast, chkFmt] = ['#at-chk-human', '#at-chk-fast', '#at-chk-fmt'].map(id => modal.querySelector(id));
    const statusText = modal.querySelector('#at-status-text');
    const statusSub = modal.querySelector('#at-status-sub');
    const progressBar = modal.querySelector('#at-progress-bar');
    const pauseBtn = modal.querySelector('#at-pause');
    const startBtn = modal.querySelector('#at-start');
    const wpmVal = modal.querySelector('#at-wpm-val');

    wpmSlider.oninput = () => wpmVal.textContent = wpmSlider.value;
    errSlider.oninput = () => modal.querySelector('#at-err-val').textContent = errSlider.value + '%';
    conSlider.oninput = () => modal.querySelector('#at-con-val').textContent = conSlider.value + '%';
    brkPctSlider.oninput = () => modal.querySelector('#at-brk-pct-val').textContent = brkPctSlider.value + '%';

    const toggleHumanUI = (isHuman) => {
        ['#row-errors', '#row-consistency', '#row-breaks', '#row-break-time'].forEach(s => {
            modal.querySelector(s).style.opacity = isHuman ? '1' : '0.4';
        });
    };

    chkFast.onchange = () => { 
        chkHuman.checked = !chkFast.checked; 
        toggleHumanUI(!chkFast.checked);
        if (chkFast.checked) {
            wpmSlider.max = 600;
            wpmSlider.value = 600;
            wpmVal.textContent = '600';
        } else {
            wpmSlider.max = 220;
            if (parseInt(wpmSlider.value) > 220) {
                wpmSlider.value = 220;
                wpmVal.textContent = '220';
            }
        }
    };
    chkHuman.onchange = () => { 
        chkFast.checked = !chkHuman.checked; 
        toggleHumanUI(chkHuman.checked);
        if (chkHuman.checked) {
            wpmSlider.max = 220;
            if (parseInt(wpmSlider.value) > 220) {
                wpmSlider.value = 220;
                wpmVal.textContent = '220';
            }
        }
    };

    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target.closest('#at-toast') || target.closest('#at-modal')) return;
        const isInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable || target.classList.contains('ace_text-input');
        if (isInput && !isTyping) {
            lastTarget = target;
            clearTimeout(dismissTimeout);
            toast.style.display = 'flex';
            dismissTimeout = setTimeout(() => toast.style.display = 'none', 15000);
        }
    }, true);

    document.addEventListener('pointerdown', (e) => {
        if (isTyping && modal.style.display === 'block') {
            const clickedModal = modal.contains(e.target);
            const clickedTarget = lastTarget && (lastTarget.contains(e.target) || e.target === lastTarget);

            if (!isPaused && !clickedModal && !clickedTarget) {
                setPauseState(true, 'Auto-Paused (Clicked away)');
            } else if (isPaused && clickedTarget) {
                setPauseState(false);
            }
        }
    });

    toast.querySelector('#at-btn-yes').onclick = () => {
        toast.style.display = 'none';
        clearTimeout(dismissTimeout);
        modal.style.display = 'block';
        setupView.style.display = 'block';
        activeView.style.display = 'none';
        updateModeLabel();
        modal.querySelector('#at-input').focus();
    };
    toast.querySelector('#at-btn-no').onclick = () => toast.style.display = 'none';

    const handleCancel = () => {
        isTyping = false;
        if (isPaused && pauseResolver) pauseResolver();
        timerWorker.postMessage({ action: 'cancel' });
        modal.style.display = 'none';
        setupView.style.display = 'block';
        activeView.style.display = 'none';
        startBtn.textContent = 'Start Typing';
        startBtn.disabled = false;
    };
    modal.querySelector('#at-cancel-setup').onclick = handleCancel;
    modal.querySelector('#at-cancel-active').onclick = handleCancel;

    function setPauseState(paused, customMsg = 'Paused') {
        isPaused = paused;
        if (paused) {
            pauseBtn.textContent = 'Resume';
            pauseBtn.className = 'btn-primary';
            statusText.textContent = customMsg;
            statusText.style.color = '#eab308';
        } else {
            pauseBtn.textContent = 'Pause';
            pauseBtn.className = 'btn-warning';
            statusText.textContent = 'Typing...';
            statusText.style.color = '#3b82f6';
            if (pauseResolver) { pauseResolver(); pauseResolver = null; }
        }
    }
    pauseBtn.onclick = () => setPauseState(!isPaused);

    function dispatchChar(char) {
        if (!lastTarget) return;
        const isCE = lastTarget.isContentEditable;
        
        if (char === '\b') {
            if (isCE) document.execCommand('delete', false, null);
            else if ('value' in lastTarget && typeof lastTarget.selectionStart === 'number') {
                const s = lastTarget.selectionStart;
                if (s > 0) {
                    lastTarget.value = lastTarget.value.substring(0, s - 1) + lastTarget.value.substring(lastTarget.selectionEnd);
                    lastTarget.selectionStart = lastTarget.selectionEnd = s - 1;
                }
            }
            ['keydown', 'keyup'].forEach(e => lastTarget.dispatchEvent(new KeyboardEvent(e, { key: 'Backspace', keyCode: 8, bubbles: true })));
            lastTarget.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        if (char === '\n') {
            lastTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            lastTarget.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13, which: 13, bubbles: true }));

            if (isCE) {
                document.execCommand('insertLineBreak') || document.execCommand('insertText', false, '\n');
            } else if ('value' in lastTarget && typeof lastTarget.selectionStart === 'number') {
                const s = lastTarget.selectionStart, e = lastTarget.selectionEnd;
                lastTarget.value = lastTarget.value.substring(0, s) + '\n' + lastTarget.value.substring(e);
                lastTarget.selectionStart = lastTarget.selectionEnd = s + 1;
            }

            lastTarget.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            lastTarget.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        if (char === '\t') {
            lastTarget.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
            if (isCE) document.execCommand('insertText', false, '    ');
            else if ('value' in lastTarget && typeof lastTarget.selectionStart === 'number') {
                const s = lastTarget.selectionStart, e = lastTarget.selectionEnd;
                lastTarget.value = lastTarget.value.substring(0, s) + '    ' + lastTarget.value.substring(e);
                lastTarget.selectionStart = lastTarget.selectionEnd = s + 4;
            }
            lastTarget.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
            lastTarget.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        if (isCE) document.execCommand('insertText', false, char);
        else if ('value' in lastTarget && typeof lastTarget.selectionStart === 'number') {
            const s = lastTarget.selectionStart, e = lastTarget.selectionEnd;
            lastTarget.value = lastTarget.value.substring(0, s) + char + lastTarget.value.substring(e);
            lastTarget.selectionStart = lastTarget.selectionEnd = s + 1;
        }
        
        ['keydown', 'keypress', 'keyup'].forEach(e => lastTarget.dispatchEvent(new KeyboardEvent(e, { key: char, bubbles: true })));
        lastTarget.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // --- MODE DETECTION ---
    // Non-student: sandbox / share pages. Everything else is treated as the student editor,
    // where the IDE auto-completes brackets and quotes.
    const NON_STUDENT_PREFIXES = ['https://codehs.com/sandbox/id', 'https://codehs.com/share/'];
    const CLOSERS = [')', ']', '}', '"', "'"];

    function getPageUrl() {
        try { return window.top.location.href; } catch (e) { return location.href; }
    }
    function isStudentMode() {
        const url = getPageUrl();
        return !NON_STUDENT_PREFIXES.some(prefix => url.startsWith(prefix));
    }
    function updateModeLabel() {
        const label = modal.querySelector('#at-mode');
        label.textContent = isStudentMode()
            ? 'Mode: Student (skips auto-closed brackets with Arrow Right)'
            : 'Mode: Non-student (sandbox/share)';
    }

    // --- EDITOR HELPERS (student mode) ---
    function getAceEditor() {
        if (!lastTarget || !lastTarget.closest) return null;
        const host = lastTarget.closest('.ace_editor');
        if (!host) return null;
        if (host.env && host.env.editor) return host.env.editor;
        try { if (window.ace) return window.ace.edit(host); } catch (e) {}
        return null;
    }

    function editorState() {
        const ed = getAceEditor();
        if (!ed) return null;
        const pos = ed.getCursorPosition();
        const doc = ed.session.getDocument();
        const line = doc.getLine(pos.row);
        return {
            ed, row: pos.row, col: pos.column, line,
            rest: line.slice(pos.column),
            below: pos.row + 1 < doc.getLength() ? doc.getLine(pos.row + 1) : ''
        };
    }

    function pressKey(key, keyCode) {
        ['keydown', 'keyup'].forEach(type => lastTarget.dispatchEvent(
            new KeyboardEvent(type, { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true })
        ));
    }

    // The IDE already placed this closer right after the cursor: press Arrow Right instead of typing it.
    async function skipIfClosing(char) {
        const st = editorState();
        if (!st || st.rest[0] !== char) return false;
        pressKey('ArrowRight', 39);
        await wait(15);
        const after = editorState();
        if (after && !(after.row === st.row && after.col === st.col + 1)) {
            st.ed.moveCursorTo(st.row, st.col + 1);
            st.ed.clearSelection();
        }
        return true;
    }

    // The IDE pushed an auto-inserted closer onto the line below (typed "{" then Enter).
    // Instead of pressing Enter and typing it again, go down to that line and sit after the closer.
    async function skipToCloser(closer) {
        const st = editorState();
        if (!st || st.rest.trim() !== '' || !st.below.trimStart().startsWith(closer)) return false;
        const targetCol = st.below.search(/\S/) + 1;
        pressKey('ArrowDown', 40);
        await wait(15);
        pressKey('End', 35);
        await wait(15);
        const after = editorState();
        if (!after || after.row !== st.row + 1 || after.col !== targetCol) {
            st.ed.moveCursorTo(st.row + 1, targetCol);
            st.ed.clearSelection();
        }
        return true;
    }

    // --- INDENTATION ---
    // The IDE auto-indents (and auto-outdents on "}"), so we type NO leading whitespace.
    // Every line is typed flush-left and the editor places it correctly on its own.
    function compileKeystrokes(rawText, stripIndent, studentMode) {
        const lines = rawText.replace(/\r\n?/g, '\n').split('\n');
        const queue = [];
        for (let l = 0; l < lines.length; l++) {
            let line = lines[l];
            if (stripIndent) line = line.replace(/^[ \t]+/, '');
            if (l > 0) {
                if (studentMode) {
                    // Remember if the next line opens with a closer the IDE may already have placed below.
                    const first = line[0];
                    queue.push({ nl: true, closer: (first && ')]}'.includes(first)) ? first : null });
                } else {
                    queue.push('\n');
                }
            }
            for (const ch of line) queue.push(ch);
        }
        return queue;
    }

    function getDelay(wpm, consistency, isHuman) {
        if (!isHuman) return 12000 / wpm; 
        const baseMs = 12000 / wpm; 
        return Math.max(15, baseMs + ((Math.random() * 2 - 1) * (baseMs * ((100 - consistency) / 100))));
    }

    startBtn.onclick = async () => {
        const text = modal.querySelector('#at-input').value;
        if (!text) return;

        startBtn.disabled = true;
        for (let c = 3; c > 0; c--) {
            if (modal.style.display === 'none') {
                startBtn.textContent = 'Start Typing';
                startBtn.disabled = false;
                return;
            }
            startBtn.textContent = `Typing in... (${c})`;
            await wait(1000);
        }

        if (modal.style.display === 'none') {
            startBtn.textContent = 'Start Typing';
            startBtn.disabled = false;
            return;
        }

        startBtn.textContent = 'Typing';
        await wait(50); 

        if (!lastTarget) {
            alert("No text box selected! Please click inside the editor before the countdown finishes.");
            startBtn.textContent = 'Start Typing';
            startBtn.disabled = false;
            return;
        }

        const wpm = parseInt(wpmSlider.value, 10);
        const errRate = parseInt(errSlider.value, 10) / 100;
        const consistency = parseInt(conSlider.value, 10);
        const isHuman = chkHuman.checked && !chkFast.checked;
        const smartFmt = chkFmt.checked;
        
        const brkPct = parseInt(brkPctSlider.value, 10) / 100;
        let [brkMin, brkMax] = [parseFloat(modal.querySelector('#at-brk-min').value), parseFloat(modal.querySelector('#at-brk-max').value)];
        if (brkMin > brkMax) [brkMin, brkMax] = [brkMax, brkMin];

        setupView.style.display = 'none';
        activeView.style.display = 'flex';
        progressBar.style.width = '0%';
        isTyping = true;
        setPauseState(false); 

        const studentMode = isStudentMode();
        if (studentMode && !getAceEditor()) {
            console.warn('[Ghost Typer] Student mode needs the Ace editor to detect auto-closed brackets, but none was found.');
        }
        let consumeCloser = null;

        const stream = compileKeystrokes(text, smartFmt || studentMode, studentMode);
        const totalChars = Math.max(1, stream.length);
        let typed = 0;

        for (let i = 0; i < stream.length; i++) {
            if (!isTyping) break;
            if (isPaused) { await new Promise(r => pauseResolver = r); if (!isTyping) break; }

            const item = stream[i];
            const isNl = typeof item === 'object';
            const char = isNl ? '\n' : item;

            // The newline before this line already moved us past its leading closer: don't type it again.
            if (consumeCloser !== null) {
                const pending = consumeCloser;
                consumeCloser = null;
                if (!isNl && char === pending) {
                    typed++;
                    progressBar.style.width = `${(typed / totalChars) * 100}%`;
                    statusSub.textContent = `${typed} / ${totalChars} characters`;
                    await wait(getDelay(wpm, consistency, isHuman));
                    continue;
                }
            }

            typed++;
            progressBar.style.width = `${(typed / totalChars) * 100}%`;
            statusSub.textContent = `${typed} / ${totalChars} characters`;

            if (isHuman && [' ', '\n', '.', ';', '{', '}'].includes(char) && Math.random() < brkPct) {
                const breakSecs = (Math.random() * (brkMax - brkMin)) + brkMin;
                statusText.textContent = `Taking a break... (${breakSecs.toFixed(1)}s)`;
                statusText.style.color = '#eab308';
                await wait(breakSecs * 1000);
                if (!isPaused) { statusText.textContent = 'Typing...'; statusText.style.color = '#3b82f6'; }
            }

            if (isHuman && !['\n', '\t', '\b'].includes(char) && Math.random() < errRate) {
                const neighbors = KEY_NEIGHBORS[char.toLowerCase()];
                if (neighbors) {
                    dispatchChar(neighbors[Math.floor(Math.random() * neighbors.length)]);
                    await wait(getDelay(wpm, consistency, true) + (Math.random() * 120 + 80)); 
                    dispatchChar('\b');
                    await wait(getDelay(wpm, consistency, true));
                }
            }

            if (isNl) {
                const skipped = studentMode && item.closer ? await skipToCloser(item.closer) : false;
                if (skipped) consumeCloser = item.closer;
                else dispatchChar('\n');
            } else if (studentMode && CLOSERS.includes(char) && await skipIfClosing(char)) {
                // closer was already there; cursor moved past it
            } else {
                dispatchChar(char);
            }

            let delay = getDelay(wpm, consistency, isHuman);
            if (isHuman) {
                if (char === ' ') delay += (Math.random() * 50 + 20);
                if (['.', ';', '(', '{', '['].includes(char)) delay += (Math.random() * 140 + 80);
            }
            await wait(delay);
        }

        if (isTyping) {
            isTyping = false;
            statusText.textContent = 'Finished!';
            statusText.style.color = '#22c55e';
            pauseBtn.style.display = 'none';
            modal.querySelector('#at-cancel-active').textContent = 'Close';
            startBtn.textContent = 'Start Typing';
            startBtn.disabled = false;
            if (lastTarget) lastTarget.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };
})();
