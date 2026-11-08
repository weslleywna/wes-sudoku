(function () {
  'use strict';

  const { PEERS, rowOf, colOf, boxOf, candidates, generate } = window.Sudoku;

  const DIFFICULTIES = {
    easy:   { label: 'Fácil',        hints: 5, mistakes: 5 },
    medium: { label: 'Médio',        hints: 4, mistakes: 4 },
    hard:   { label: 'Difícil',      hints: 3, mistakes: 3 },
    expert: { label: 'Especialista', hints: 2, mistakes: 2 },
  };

  const describe = (d) => `${d.hints} dicas · ${settings.lives ? `${d.mistakes} vidas` : 'erros ilimitados'}`;
  const maxMistakes = () => DIFFICULTIES[game.difficulty].mistakes;
  const hasLives = () => game.lives !== false; // jogos salvos antes da opção tinham vidas
  const mistakesText = () => (hasLives() ? `${game.mistakes}/${maxMistakes()}` : String(game.mistakes));

  const KEYS = {
    game: 'wes-sudoku:game',
    theme: 'wes-sudoku:theme',
    settings: 'wes-sudoku:settings',
    best: 'wes-sudoku:best',
  };

  const storage = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento */ } },
  };

  // ---------- Estado ----------
  let game = null;          // dados do jogo (persistidos)
  let selected = -1;
  let notesMode = false;
  let paused = false;
  let history = [];
  const settings = Object.assign({ checkErrors: true, lives: true }, storage.get(KEYS.settings));

  // ---------- Elementos ----------
  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const numpadEl = $('numpad');
  const cells = [];
  const numButtons = [];

  // ---------- Construção da interface ----------
  function buildBoard() {
    for (let i = 0; i < 81; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `cell r${rowOf(i)} c${colOf(i)}`;
      cell.setAttribute('role', 'gridcell');
      cell.tabIndex = -1;
      cell.dataset.index = i;

      const value = document.createElement('span');
      value.className = 'value';
      const notes = document.createElement('span');
      notes.className = 'notes';
      const noteSpans = [];
      for (let n = 1; n <= 9; n++) {
        const s = document.createElement('span');
        notes.appendChild(s);
        noteSpans.push(s);
      }
      cell.append(value, notes);
      boardEl.appendChild(cell);
      cells.push({ el: cell, value, noteSpans });
    }

    boardEl.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      select(Number(cell.dataset.index));
    });
  }

  function buildNumpad() {
    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'num';
      btn.innerHTML = `${n}<small></small>`;
      btn.addEventListener('click', () => input(n));
      numpadEl.appendChild(btn);
      numButtons.push(btn);
    }
  }

  function buildDifficultyList() {
    const list = $('difficulty-list');
    for (const [key, d] of Object.entries(DIFFICULTIES)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'difficulty-option';
      btn.dataset.difficulty = key;
      btn.innerHTML = `<span>${d.label}</span><small></small>`;
      btn.addEventListener('click', () => {
        $('dlg-new').close();
        newGame(key);
      });
      list.appendChild(btn);
    }
  }

  // ---------- Jogo ----------
  function newGame(difficulty) {
    const { puzzle, solution } = generate(difficulty);
    game = {
      difficulty,
      puzzle,
      solution,
      values: puzzle.slice(),
      notes: new Array(81).fill(0),
      hinted: new Array(81).fill(0),
      hintsLeft: DIFFICULTIES[difficulty].hints,
      hintsUsed: 0,
      mistakes: 0,
      elapsed: 0,
      finished: false,
      lost: false,
      lives: settings.lives,
    };
    history = [];
    notesMode = false;
    paused = false;
    selected = -1;
    boardEl.classList.remove('solved');
    save();
    render();
  }

  function restartGame() {
    if (!game) return;
    Object.assign(game, {
      lives: settings.lives,
      values: game.puzzle.slice(),
      notes: new Array(81).fill(0),
      hinted: new Array(81).fill(0),
      hintsLeft: DIFFICULTIES[game.difficulty].hints,
      hintsUsed: 0,
      mistakes: 0,
      elapsed: 0,
      finished: false,
      lost: false,
    });
    history = [];
    paused = false;
    selected = -1;
    boardEl.classList.remove('solved');
    save();
    render();
  }

  function loadGame() {
    const saved = storage.get(KEYS.game);
    if (saved && Array.isArray(saved.puzzle) && saved.puzzle.length === 81 && DIFFICULTIES[saved.difficulty]) {
      game = saved;
      if (game.finished && !game.lost) boardEl.classList.add('solved');
      return true;
    }
    return false;
  }

  function save() {
    if (game) storage.set(KEYS.game, game);
  }

  const isLocked = (i) => game.puzzle[i] !== 0 || game.hinted[i] === 1;

  function snapshot() {
    history.push({
      values: game.values.slice(),
      notes: game.notes.slice(),
      selected,
    });
    if (history.length > 300) history.shift();
  }

  function undo() {
    if (!history.length || game.finished || paused) return;
    const prev = history.pop();
    game.values = prev.values;
    game.notes = prev.notes;
    selected = prev.selected;
    save();
    render();
  }

  function select(i) {
    if (paused) return;
    selected = i;
    if (i >= 0) cells[i].el.focus({ preventScroll: true });
    render();
  }

  function clearNoteFromPeers(i, n) {
    const bit = ~(1 << n);
    for (const p of PEERS[i]) game.notes[p] &= bit;
  }

  function input(n, forceNote = false) {
    if (!game || game.finished || paused) return;
    const i = selected;
    if (i < 0) { toast('Selecione uma casa primeiro'); return; }
    if (isLocked(i)) return;

    if (notesMode || forceNote) {
      if (game.values[i]) return;
      snapshot();
      game.notes[i] ^= 1 << n;
      save();
      render();
      return;
    }

    snapshot();
    if (game.values[i] === n) {
      game.values[i] = 0; // tocar no mesmo número apaga
    } else {
      game.values[i] = n;
      game.notes[i] = 0;
      clearNoteFromPeers(i, n);
      animateCell(i, 'pop');
      if (n !== game.solution[i]) {
        game.mistakes++;
        bump($('status-mistakes'));
        if (hasLives() && game.mistakes >= maxMistakes()) {
          lose();
          return;
        }
      }
    }
    afterMove();
  }

  function erase() {
    if (!game || game.finished || paused) return;
    const i = selected;
    if (i < 0 || isLocked(i)) return;
    if (!game.values[i] && !game.notes[i]) return;
    snapshot();
    game.values[i] = 0;
    game.notes[i] = 0;
    afterMove();
  }

  function hint() {
    if (!game || game.finished || paused) return;
    if (game.hintsLeft <= 0) { toast('Você já usou todas as dicas deste jogo'); return; }

    const needsHelp = (i) => !isLocked(i) && game.values[i] !== game.solution[i];
    let target = -1;

    if (selected >= 0 && needsHelp(selected)) {
      target = selected;
    } else {
      // Prioriza uma casa errada; senão, a casa vazia com menos possibilidades.
      let bestCount = 10;
      for (let i = 0; i < 81; i++) {
        if (!needsHelp(i)) continue;
        if (game.values[i]) { target = i; break; }
        const count = window.Sudoku.popcount(candidates(game.values, i));
        if (count < bestCount) { bestCount = count; target = i; }
      }
    }
    if (target < 0) return;

    snapshot();
    const n = game.solution[target];
    game.values[target] = n;
    game.notes[target] = 0;
    game.hinted[target] = 1;
    game.hintsLeft--;
    game.hintsUsed++;
    clearNoteFromPeers(target, n);
    selected = target;
    // Dicas não podem ser desfeitas (evita "dicas grátis").
    history = [];
    animateCell(target, 'flash');
    afterMove();
  }

  function autoNotes() {
    if (!game || game.finished || paused) return;
    snapshot();
    for (let i = 0; i < 81; i++) {
      game.notes[i] = game.values[i] ? 0 : candidates(game.values, i);
    }
    save();
    render();
    toast('Anotações preenchidas com todos os números possíveis');
  }

  function toggleNotes() {
    notesMode = !notesMode;
    render();
  }

  function afterMove() {
    if (game.values.every((v, i) => v === game.solution[i])) {
      finish();
    }
    save();
    render();
  }

  function lose() {
    game.finished = true;
    game.lost = true;
    selected = -1;
    history = [];
    save();
    render();
    showLostDialog(500);
  }

  function showLostDialog(delay = 0) {
    const max = maxMistakes();
    $('lost-subtitle').textContent =
      `Você errou ${max} ${max === 1 ? 'vez' : 'vezes'}, o limite do nível ${DIFFICULTIES[game.difficulty].label}.`;
    setTimeout(() => { if (!$('dlg-lost').open) $('dlg-lost').showModal(); }, delay);
  }

  function finish() {
    game.finished = true;
    selected = -1;
    boardEl.classList.add('solved');
    cells.forEach((c, i) => {
      c.el.style.animationDelay = `${(rowOf(i) + colOf(i)) * 35}ms`;
    });

    const best = storage.get(KEYS.best) || {};
    const prev = best[game.difficulty];
    const isRecord = game.hintsUsed === 0 && (!prev || game.elapsed < prev);
    if (isRecord) {
      best[game.difficulty] = game.elapsed;
      storage.set(KEYS.best, best);
    }

    const d = DIFFICULTIES[game.difficulty];
    $('win-subtitle').textContent = isRecord
      ? `Novo recorde no nível ${d.label}!`
      : `Você resolveu um sudoku ${d.label.toLowerCase()}.`;
    const rows = [
      ['Tempo', formatTime(game.elapsed)],
      ['Recorde', formatTime(best[game.difficulty]) || '—'],
      ['Dicas usadas', game.hintsUsed],
      ['Erros', mistakesText()],
    ];
    $('win-stats').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    setTimeout(() => $('dlg-win').showModal(), 700);
  }

  // ---------- Renderização ----------
  function render() {
    if (!game) return;
    const sel = selected;
    const selValue = sel >= 0 ? game.values[sel] : 0;

    // Conflitos pelas regras (número repetido na linha/coluna/bloco).
    const conflict = new Array(81).fill(false);
    for (let i = 0; i < 81; i++) {
      const v = game.values[i];
      if (!v) continue;
      for (const p of PEERS[i]) {
        if (game.values[p] === v) { conflict[i] = true; break; }
      }
    }

    for (let i = 0; i < 81; i++) {
      const { el, value, noteSpans } = cells[i];
      const v = game.values[i];
      const given = game.puzzle[i] !== 0;
      const related = sel >= 0 && i !== sel &&
        (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel));

      el.classList.toggle('given', given);
      el.classList.toggle('hinted', game.hinted[i] === 1);
      el.classList.toggle('selected', i === sel);
      el.classList.toggle('related', related);
      el.classList.toggle('same', !!selValue && v === selValue && i !== sel);
      el.classList.toggle('conflict', conflict[i] && !given);
      el.classList.toggle('error', settings.checkErrors && !!v && !given && v !== game.solution[i]);

      value.textContent = v || '';
      const notes = v ? 0 : game.notes[i];
      for (let n = 1; n <= 9; n++) {
        const on = (notes >> n) & 1;
        noteSpans[n - 1].textContent = on ? n : '';
        noteSpans[n - 1].classList.toggle('match', !!on && n === selValue);
      }

      const r = rowOf(i) + 1, c = colOf(i) + 1;
      el.setAttribute('aria-label', `Linha ${r}, coluna ${c}: ${v || 'vazia'}${given ? ' (fixa)' : ''}`);
    }

    // Teclado numérico: quantos de cada número ainda faltam (corretos).
    const placed = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      const v = game.values[i];
      if (v && v === game.solution[i]) placed[v]++;
    }
    numButtons.forEach((btn, idx) => {
      const n = idx + 1;
      const left = 9 - placed[n];
      btn.querySelector('small').textContent = left > 0 ? left : '';
      btn.disabled = game.finished || (left === 0 && !notesMode);
      btn.setAttribute('aria-label', `Número ${n}, faltam ${left}`);
    });
    numpadEl.classList.toggle('notes-mode', notesMode);

    // Ferramentas
    $('btn-notes').setAttribute('aria-pressed', String(notesMode));
    $('notes-state').textContent = notesMode ? 'On' : 'Off';
    $('btn-undo').disabled = history.length === 0 || game.finished;
    $('btn-hint').disabled = game.finished;
    $('btn-erase').disabled = game.finished;
    $('btn-autonotes').disabled = game.finished;
    const hc = $('hint-count');
    hc.textContent = game.hintsLeft;
    hc.classList.toggle('empty', game.hintsLeft === 0);
    $('btn-hint').title = `Dica (H) — restam ${game.hintsLeft}`;

    // Status
    $('status-difficulty').textContent = DIFFICULTIES[game.difficulty].label;
    $('status-mistakes').textContent = mistakesText();
    $('status-mistakes').parentElement.title = hasLives() ? 'Erros / limite' : 'Erros (sem limite)';
    $('status-mistakes').parentElement.classList.toggle('danger',
      hasLives() && game.mistakes > 0 && game.mistakes >= maxMistakes() - 1);
    $('lost-overlay').hidden = !game.lost;
    $('status-timer').textContent = formatTime(game.elapsed);
    $('btn-pause').classList.toggle('paused', paused);
    $('btn-pause').disabled = game.finished;
    $('paused-overlay').hidden = !paused;
    $('opt-check').checked = settings.checkErrors;
  }

  function animateCell(i, cls) {
    const el = cells[i].el;
    el.classList.remove(cls);
    void el.offsetWidth; // reinicia a animação
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 650);
  }

  function bump(el) {
    el.animate?.([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 250 });
  }

  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function formatTime(sec) {
    if (sec == null) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // ---------- Tempo ----------
  function setPaused(value) {
    if (!game || game.finished) return;
    paused = value;
    render();
  }

  setInterval(() => {
    if (!game || game.finished || paused || document.hidden) return;
    game.elapsed++;
    $('status-timer').textContent = formatTime(game.elapsed);
    if (game.elapsed % 5 === 0) save();
  }, 1000);

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  // ---------- Tema ----------
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    storage.set(KEYS.theme, theme);
  }

  // ---------- Teclado ----------
  function onKey(e) {
    if (document.querySelector('dialog[open]')) return;
    if (!game) return;

    const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (digit && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      input(Number(digit[2]), e.shiftKey);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in moves) {
      e.preventDefault();
      if (paused) return;
      if (selected < 0) { select(40); return; }
      let r = rowOf(selected), c = colOf(selected);
      if (e.key === 'ArrowUp') r = (r + 8) % 9;
      if (e.key === 'ArrowDown') r = (r + 1) % 9;
      if (e.key === 'ArrowLeft') c = (c + 8) % 9;
      if (e.key === 'ArrowRight') c = (c + 1) % 9;
      select(r * 9 + c);
      return;
    }

    switch (e.key) {
      case 'Backspace': case 'Delete': case '0':
        e.preventDefault(); erase(); break;
      case 'n': case 'N':
        toggleNotes(); break;
      case 'h': case 'H':
        hint(); break;
      case 'p': case 'P':
        setPaused(!paused); break;
      case 'Escape':
        select(-1); break;
    }
  }

  // ---------- Eventos ----------
  function bindEvents() {
    $('btn-undo').addEventListener('click', undo);
    $('btn-erase').addEventListener('click', erase);
    $('btn-notes').addEventListener('click', toggleNotes);
    $('btn-hint').addEventListener('click', hint);
    $('btn-autonotes').addEventListener('click', autoNotes);
    $('btn-pause').addEventListener('click', () => setPaused(!paused));
    $('btn-resume').addEventListener('click', () => setPaused(false));

    $('btn-theme').addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    $('btn-new').addEventListener('click', openNewDialog);
    $('btn-restart').addEventListener('click', () => {
      $('dlg-new').close();
      restartGame();
      toast('Jogo recomeçado');
    });
    $('btn-lost-new').addEventListener('click', () => {
      $('dlg-lost').close();
      openNewDialog();
    });
    $('btn-lost-retry').addEventListener('click', () => {
      $('dlg-lost').close();
      restartGame();
    });
    $('btn-overlay-new').addEventListener('click', openNewDialog);
    $('btn-win-new').addEventListener('click', () => {
      $('dlg-win').close();
      openNewDialog();
    });

    $('opt-lives').addEventListener('change', (e) => {
      settings.lives = e.target.checked;
      storage.set(KEYS.settings, settings);
      // Vale também para a partida em andamento (salvo se ligar as vidas
      // num jogo que já passou do limite: aí só vale para o próximo).
      if (game && !game.finished && (!settings.lives || game.mistakes < maxMistakes())) {
        game.lives = settings.lives;
        save();
        render();
      }
      refreshDifficultyList();
    });

    $('opt-check').addEventListener('change', (e) => {
      settings.checkErrors = e.target.checked;
      storage.set(KEYS.settings, settings);
      render();
    });

    // Clique fora do tabuleiro e dos controles tira a seleção.
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.board, .controls, dialog, .status')) select(-1);
    });

    // Fecha o diálogo ao clicar no fundo.
    document.querySelectorAll('dialog').forEach((dlg) => {
      if (dlg.id === 'dlg-lost') {
        dlg.addEventListener('cancel', (e) => e.preventDefault()); // precisa escolher uma opção
        return;
      }
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    });

    document.addEventListener('keydown', onKey);
  }

  function openNewDialog() {
    $('opt-lives').checked = settings.lives;
    refreshDifficultyList();
    $('btn-restart').hidden = !game;
    $('dlg-new').showModal();
  }

  // Atualiza descrições, recordes e destaca a dificuldade atual.
  function refreshDifficultyList() {
    const appliesNow = game && !game.finished && game.lives === settings.lives;
    $('lives-hint').textContent = settings.lives
      ? `O jogo acaba ao atingir o limite de erros${appliesNow ? ', inclusive nesta partida' : ' (a partir do próximo jogo)'}.`
      : `Erros só são contados, sem fim de jogo${appliesNow ? ', inclusive nesta partida' : ''}.`;
    const best = storage.get(KEYS.best) || {};
    document.querySelectorAll('.difficulty-option').forEach((btn) => {
      const key = btn.dataset.difficulty;
      const d = DIFFICULTIES[key];
      btn.classList.toggle('current', game && game.difficulty === key);
      btn.querySelector('small').textContent = describe(d) + (best[key] ? ` · recorde ${formatTime(best[key])}` : '');
    });
  }

  // ---------- Início ----------
  buildBoard();
  buildNumpad();
  buildDifficultyList();
  bindEvents();
  if (!loadGame()) newGame('medium');
  render();
  if (game.lost) showLostDialog();
})();
