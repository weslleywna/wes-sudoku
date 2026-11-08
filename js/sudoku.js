/*
 * Motor do Sudoku: gerador, solucionador e utilitários.
 * O tabuleiro é um array de 81 inteiros (0 = vazio), lido linha a linha.
 */
(function (global) {
  'use strict';

  const ALL = 0x3fe; // bits 1..9

  const rowOf = (i) => (i / 9) | 0;
  const colOf = (i) => i % 9;
  const boxOf = (i) => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);

  // Para cada célula, as 20 células que compartilham linha, coluna ou bloco.
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const peers = [];
    for (let j = 0; j < 81; j++) {
      if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) {
        peers.push(j);
      }
    }
    return peers;
  });

  function popcount(x) {
    let c = 0;
    while (x) { x &= x - 1; c++; }
    return c;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function bitsToDigits(mask) {
    const out = [];
    for (let n = 1; n <= 9; n++) if (mask & (1 << n)) out.push(n);
    return out;
  }

  /**
   * Busca com retrocesso (escolhendo sempre a célula com menos candidatos).
   * Retorna { count, solution } — para quando encontra `limit` soluções.
   */
  function search(grid, limit, randomize) {
    const g = grid.slice();
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);

    for (let i = 0; i < 81; i++) {
      const v = g[i];
      if (!v) continue;
      const bit = 1 << v;
      const r = rowOf(i), c = colOf(i), b = boxOf(i);
      if ((rows[r] | cols[c] | boxes[b]) & bit) return { count: 0, solution: null };
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }

    let count = 0;
    let solution = null;

    function step() {
      let best = -1, bestMask = 0, bestCount = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const mask = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
        const n = popcount(mask);
        if (n < bestCount) {
          best = i; bestMask = mask; bestCount = n;
          if (n <= 1) break;
        }
      }
      if (best === -1) {
        count++;
        if (!solution) solution = g.slice();
        return;
      }
      if (bestCount === 0) return;

      let digits = bitsToDigits(bestMask);
      if (randomize) shuffle(digits);
      const r = rowOf(best), c = colOf(best), b = boxOf(best);
      for (const d of digits) {
        const bit = 1 << d;
        g[best] = d;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        step();
        rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
        g[best] = 0;
        if (count >= limit) return;
      }
    }

    step();
    return { count, solution };
  }

  function solve(grid) {
    return search(grid, 1, false).solution;
  }

  function countSolutions(grid, limit = 2) {
    return search(grid, limit, false).count;
  }

  function fullGrid() {
    return search(new Array(81).fill(0), 1, true).solution;
  }

  // Quantidade alvo de pistas por dificuldade.
  const CLUES = { easy: 40, medium: 33, hard: 28, expert: 24 };

  /** Gera um quebra-cabeça com solução única. */
  function generate(difficulty = 'medium') {
    const target = CLUES[difficulty] ?? CLUES.medium;
    let best = null;
    // Algumas tentativas: fica com a que tiver menos pistas (importa nos níveis difíceis).
    for (let attempt = 0; attempt < 8; attempt++) {
      const result = carve(target);
      if (!best || result.clues < best.clues) best = result;
      if (best.clues <= target) break;
    }
    return { puzzle: best.puzzle, solution: best.solution };
  }

  function carve(target) {
    const solution = fullGrid();
    const puzzle = solution.slice();
    let clues = 81;

    // Remove pares simétricos (estética clássica de sudoku), mantendo a solução única.
    const order = shuffle([...Array(41).keys()]);
    for (const i of order) {
      if (clues <= target) break;
      const j = 80 - i;
      const a = puzzle[i], b = puzzle[j];
      puzzle[i] = 0; puzzle[j] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        clues -= i === j ? 1 : 2;
      } else {
        puzzle[i] = a; puzzle[j] = b;
      }
    }

    // Segunda passada, célula a célula, se ainda faltar chegar ao alvo.
    if (clues > target) {
      for (const i of shuffle([...Array(81).keys()])) {
        if (clues <= target) break;
        if (!puzzle[i]) continue;
        const a = puzzle[i];
        puzzle[i] = 0;
        if (countSolutions(puzzle, 2) === 1) clues--;
        else puzzle[i] = a;
      }
    }

    return { puzzle, solution, clues };
  }

  /** Máscara de bits dos valores possíveis para a célula i, dado o tabuleiro atual. */
  function candidates(grid, i) {
    let used = 0;
    for (const p of PEERS[i]) if (grid[p]) used |= 1 << grid[p];
    return ALL & ~used;
  }

  global.Sudoku = {
    PEERS, rowOf, colOf, boxOf, popcount, bitsToDigits,
    solve, countSolutions, generate, candidates,
  };

  if (typeof module !== 'undefined') module.exports = global.Sudoku;
})(typeof window !== 'undefined' ? window : globalThis);
