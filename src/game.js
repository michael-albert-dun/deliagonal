const GENERATOR_METHOD = {
  SPARSE_RANDOM: "sparse-random",
  BALANCED_SPARSE: "balanced-sparse"
};
const GENERATION = {
  method: GENERATOR_METHOD.BALANCED_SPARSE,
  rows: 6,
  cols: 6,
  copiesPerColor: 4,
  rejectBelowMoves: 3,
  maxAttempts: 10000
};
const MODE = {
  SPLASH: "splash",
  PLAY: "play"
};
const ROWS = GENERATION.rows;
const COLS = GENERATION.cols;
const CANDIES = [
  { key: "orange", label: "orange" },
  { key: "blue", label: "blue" },
  { key: "green", label: "green" },
  { key: "purple", label: "purple" }
];
const COLOR_INDEX_BY_KEY = new Map(CANDIES.map((candy, index) => [candy.key, index]));

const state = {
  mode: MODE.SPLASH,
  board: [],
  initialGrid: "",
  minimumMoves: 0,
  demoMoves: [],
  deletionCount: 0,
  history: [],
  selected: [],
  settingsOpen: false,
  infoOpen: false,
  animationToken: 0,
  clearAnimationCells: new Set()
};
let demoTimer = null;

const elements = {
  playArea: document.querySelector(".play-area"),
  board: document.querySelector("#board"),
  challenge: document.querySelector("#challenge"),
  score: document.querySelector("#score"),
  newButton: document.querySelector("#new-button"),
  infoButton: document.querySelector("#info-button"),
  infoPanel: document.querySelector("#info-panel"),
  undoButton: document.querySelector("#undo-button"),
  settingsButton: document.querySelector("#settings-button"),
  settingsPanel: document.querySelector("#settings-panel"),
  copiesPerColorInputs: document.querySelectorAll("[name='copies-per-color']")
};

elements.board.style.setProperty("--board-cols", String(COLS));
elements.newButton.addEventListener("click", () => startGame());
elements.infoButton.setAttribute("aria-controls", "info-panel");
elements.infoButton.setAttribute("aria-expanded", "false");
elements.infoButton.addEventListener("click", toggleInfoPanel);
elements.undoButton.addEventListener("click", undoLastDeletion);
elements.settingsButton.setAttribute("aria-controls", "settings-panel");
elements.settingsButton.setAttribute("aria-expanded", "false");
elements.settingsButton.addEventListener("click", toggleSettingsPanel);
elements.copiesPerColorInputs.forEach((input) => {
  input.addEventListener("change", updateCopiesPerColor);
});
document.addEventListener("keydown", handleKeyDown);
const urlBoard = loadBoardFromUrl();

if (urlBoard) {
  startGame({ board: urlBoard });
} else {
  startSplash();
}

function startSplash() {
  stopDemoLoop();
  state.mode = MODE.SPLASH;
  state.board = makeRandomBoard();
  state.initialGrid = "";
  state.minimumMoves = minimumMoveCount(state.board.map((cell) => cell.candy));
  state.demoMoves = findMinimumSolution(state.board.map((cell) => cell.candy));
  state.deletionCount = 0;
  state.history = [];
  state.selected = [];
  state.settingsOpen = false;
  state.infoOpen = false;
  state.animationToken += 1;
  state.clearAnimationCells.clear();
  render();
  demoTimer = window.setTimeout(runDemoStep, 850);
}

function startGame({ board = null } = {}) {
  stopDemoLoop();
  state.mode = MODE.PLAY;
  state.board = board || makeRandomBoard();
  state.initialGrid = makeBoardGridString();
  state.minimumMoves = minimumMoveCount(state.board.map((cell) => cell.candy));
  state.demoMoves = [];
  state.deletionCount = 0;
  state.history = [];
  state.selected = [];
  state.infoOpen = false;
  state.animationToken += 1;
  state.clearAnimationCells.clear();
  updateAddressBar();
  render();
}

function makeRandomBoard() {
  if (GENERATION.method === GENERATOR_METHOD.SPARSE_RANDOM) {
    return makeBoardFromColorKeys(makeSparseRandomGrid(GENERATION));
  }

  if (GENERATION.method === GENERATOR_METHOD.BALANCED_SPARSE) {
    return makeBoardFromColorKeys(makeBalancedSparseGrid(GENERATION));
  }

  throw new Error(`Unknown generator method: ${GENERATION.method}`);
}

function makeSparseRandomGrid(generation) {
  for (let attempt = 1; attempt <= generation.maxAttempts; attempt += 1) {
    const grid = Array.from({ length: generation.rows * generation.cols }, () => (
      Math.random() < generation.occupancy ? randomCandyKey() : null
    ));

    if (grid.some((candy) => candy !== null) && minimumMoveCount(grid) >= generation.rejectBelowMoves) {
      return grid;
    }
  }

  throw new Error("Could not generate a sparse board meeting the move threshold.");
}

function makeBalancedSparseGrid(generation) {
  const candyCount = CANDIES.length * generation.copiesPerColor;

  if (candyCount > generation.rows * generation.cols) {
    throw new Error("Balanced sparse board has more candies than cells.");
  }

  for (let attempt = 1; attempt <= generation.maxAttempts; attempt += 1) {
    const grid = Array.from({ length: generation.rows * generation.cols }, () => null);
    const cells = shuffle(
      Array.from({ length: generation.rows * generation.cols }, (_, index) => index)
    ).slice(0, candyCount);
    const candies = shuffle(
      CANDIES.flatMap((candy) =>
        Array.from({ length: generation.copiesPerColor }, () => candy.key)
      )
    );

    cells.forEach((cell, index) => {
      grid[cell] = candies[index];
    });

    if (minimumMoveCount(grid) >= generation.rejectBelowMoves) {
      return grid;
    }
  }

  throw new Error("Could not generate a balanced sparse board meeting the move threshold.");
}

function minimumMoveCount(grid) {
  const initialMask = gridMask(grid);
  const moves = legalMoveMasks(grid);

  for (let depth = 0; depth <= ROWS * COLS; depth += 1) {
    if (canClearWithin(moves, initialMask, depth, new Set())) {
      return depth;
    }
  }

  return Infinity;
}

function findMinimumSolution(grid) {
  const initialMask = gridMask(grid);
  const moves = legalMoveMasks(grid);

  for (let depth = 0; depth <= ROWS * COLS; depth += 1) {
    const solution = findSolutionWithin(moves, initialMask, depth, new Set());

    if (solution) {
      return solution;
    }
  }

  return [];
}

function findSolutionWithin(moves, mask, depthLeft, failed) {
  if (mask === 0n) {
    return [];
  }

  if (depthLeft === 0) {
    return null;
  }

  const cacheKey = `${mask}:${depthLeft}`;

  if (failed.has(cacheKey)) {
    return null;
  }

  const nextMoves = nextMovesByClearSize(moves, mask);

  if (nextMoves.length === 0 || popCount(mask) > depthLeft * nextMoves[0].clearedCount) {
    failed.add(cacheKey);
    return null;
  }

  for (const move of nextMoves) {
    const tail = findSolutionWithin(moves, move.nextMask, depthLeft - 1, failed);

    if (tail) {
      return [move, ...tail];
    }
  }

  failed.add(cacheKey);
  return null;
}

function canClearWithin(moves, mask, depthLeft, failed) {
  if (mask === 0n) {
    return true;
  }

  if (depthLeft === 0) {
    return false;
  }

  const cacheKey = `${mask}:${depthLeft}`;

  if (failed.has(cacheKey)) {
    return false;
  }

  const nextMasks = nextMasksByClearSize(moves, mask);

  if (nextMasks.length === 0 || popCount(mask) > depthLeft * nextMasks[0].clearedCount) {
    failed.add(cacheKey);
    return false;
  }

  for (const { nextMask } of nextMasks) {
    if (canClearWithin(moves, nextMask, depthLeft - 1, failed)) {
      return true;
    }
  }

  failed.add(cacheKey);
  return false;
}

function nextMasksByClearSize(moves, mask) {
  return nextMovesByClearSize(moves, mask)
    .map(({ nextMask, clearedCount }) => ({ nextMask, clearedCount }));
}

function nextMovesByClearSize(moves, mask) {
  const bestByMask = new Map();

  moves.forEach((move) => {
    if ((mask & move.endpointsMask) !== move.endpointsMask) {
      return;
    }

    const nextMask = mask & ~move.clearMask;
    const clearedCount = popCount(mask ^ nextMask);
    const existing = bestByMask.get(nextMask);

    if (!existing || clearedCount > existing.clearedCount) {
      bestByMask.set(nextMask, { ...move, nextMask, clearedCount });
    }
  });

  return [...bestByMask.values()].sort((a, b) => b.clearedCount - a.clearedCount);
}

function makeBoardFromColorKeys(colorKeys) {
  return colorKeys.map((candy, index) => ({
    id: cellId(Math.floor(index / COLS), index % COLS),
    row: Math.floor(index / COLS),
    col: index % COLS,
    candy
  }));
}

function render() {
  elements.playArea.classList.toggle("is-splash", state.mode === MODE.SPLASH);
  elements.board.innerHTML = "";

  state.board.forEach((cell) => {
    const tile = document.createElement("button");

    tile.type = "button";
    tile.className = tileClassName(cell);
    tile.disabled = state.mode === MODE.SPLASH || cell.candy === null;
    tile.dataset.id = cell.id;
    tile.setAttribute("aria-label", tileAriaLabel(cell));
    tile.addEventListener("click", () => selectCell(cell));

    if (cell.candy !== null) {
      const candy = document.createElement("span");

      candy.className = `candy candy-${cell.candy}`;
      candy.setAttribute("aria-hidden", "true");
      tile.append(candy);
    }

    elements.board.append(tile);
  });

  elements.challenge.textContent = challengeText();
  elements.score.textContent = scoreText();
  elements.undoButton.disabled = state.mode !== MODE.PLAY ||
    (state.selected.length === 0 && state.history.length === 0);
  elements.newButton.textContent = state.mode === MODE.SPLASH ? "Play" : "New";
  elements.infoPanel.hidden = !state.infoOpen;
  elements.infoButton.setAttribute("aria-expanded", String(state.infoOpen));
  elements.settingsPanel.hidden = !state.settingsOpen;
  elements.settingsButton.setAttribute("aria-expanded", String(state.settingsOpen));
  syncSettingsInputs();
}

function challengeText() {
  if (state.mode === MODE.SPLASH) {
    return "";
  }

  return `Clear in ${state.minimumMoves}`;
}

function scoreText() {
  if (state.mode === MODE.SPLASH) {
    return "";
  }

  if (remainingCandyCount() !== 0) {
    return "";
  }

  const percentScore = state.deletionCount === 0
    ? 0
    : Math.round((state.minimumMoves / state.deletionCount) * 100);

  return `${state.minimumMoves}/${state.deletionCount} (${percentScore}%)`;
}

function tileClassName(cell) {
  return [
    "tile",
    cell.candy === null ? "is-empty" : null,
    state.selected.includes(cell.id) ? "is-selected" : null,
    state.clearAnimationCells.has(cell.id) ? "is-clearing" : null
  ].filter(Boolean).join(" ");
}

function tileAriaLabel(cell) {
  const position = `row ${cell.row + 1}, column ${cell.col + 1}`;

  if (cell.candy === null) {
    return `Empty tile at ${position}`;
  }

  return `${candyLabel(cell.candy)} candy at ${position}`;
}

function selectCell(cell) {
  if (state.mode !== MODE.PLAY) {
    return;
  }

  if (cell.candy === null) {
    return;
  }

  if (state.selected.includes(cell.id)) {
    clearRectangle(cell, cell);
    return;
  }

  if (state.selected.length === 0) {
    state.selected = [cell.id];
    render();
    return;
  }

  const firstCell = getCellById(state.selected[0]);

  if (!firstCell || firstCell.candy !== cell.candy) {
    state.selected = [cell.id];
    render();
    return;
  }

  clearRectangle(firstCell, cell);
}

function clearRectangle(firstCell, secondCell) {
  const cells = rectangleCells(firstCell, secondCell);
  const restoredCells = cells
    .filter((cell) => cell.candy !== null)
    .map((cell) => ({ id: cell.id, candy: cell.candy }));

  state.history.push({ restoredCells });
  state.deletionCount += 1;
  clearCellsWithFade(cells, () => {
    if (state.mode === MODE.PLAY) {
      render();
    }
  });
}

function undoLastDeletion() {
  if (state.selected.length > 0) {
    state.selected = [];
    render();
    return;
  }

  const action = state.history.pop();

  if (!action) {
    return;
  }

  const restoredCandyById = new Map(action.restoredCells.map((cell) => [cell.id, cell.candy]));

  state.board = state.board.map((cell) => (
    restoredCandyById.has(cell.id) ? { ...cell, candy: restoredCandyById.get(cell.id) } : cell
  ));
  state.selected = [];
  state.clearAnimationCells.clear();
  render();
}

function runDemoStep() {
  if (state.mode !== MODE.SPLASH) {
    return;
  }

  const move = state.demoMoves.shift();

  if (!move) {
    demoTimer = window.setTimeout(startSplash, 1000);
    return;
  }

  const firstCell = getCellByIndex(move.firstIndex);
  const secondCell = getCellByIndex(move.secondIndex);

  if (!firstCell || !secondCell || firstCell.candy === null || secondCell.candy === null) {
    demoTimer = window.setTimeout(startSplash, 500);
    return;
  }

  state.selected = [firstCell.id];
  render();

  demoTimer = window.setTimeout(() => {
    if (state.mode !== MODE.SPLASH) {
      return;
    }

    state.selected = [firstCell.id, secondCell.id];
    render();

    demoTimer = window.setTimeout(() => {
      if (state.mode !== MODE.SPLASH) {
        return;
      }

      clearCellsWithFade(rectangleCells(firstCell, secondCell), () => {
        demoTimer = window.setTimeout(runDemoStep, 700);
      });
    }, 850);
  }, 700);
}

function clearCellsWithFade(cells, afterClear) {
  const ids = cells.map((cell) => cell.id);
  const animationToken = ++state.animationToken;

  state.clearAnimationCells = new Set(ids);
  state.selected = [];
  render();

  window.setTimeout(() => {
    if (animationToken !== state.animationToken) {
      return;
    }

    state.board = state.board.map((cell) => (
      ids.includes(cell.id) ? { ...cell, candy: null } : cell
    ));
    state.clearAnimationCells.clear();
    render();
    afterClear();
  }, 360);
}

function stopDemoLoop() {
  if (demoTimer !== null) {
    window.clearTimeout(demoTimer);
    demoTimer = null;
  }
}

function toggleSettingsPanel() {
  state.settingsOpen = !state.settingsOpen;
  state.infoOpen = false;
  render();
}

function toggleInfoPanel() {
  state.infoOpen = !state.infoOpen;
  state.settingsOpen = false;
  render();
}

function handleKeyDown(event) {
  if (event.key.toLowerCase() !== "i" || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  event.preventDefault();
  toggleInfoPanel();
}

function updateCopiesPerColor(event) {
  GENERATION.copiesPerColor = Number(event.target.value);
  state.settingsOpen = false;

  if (state.mode === MODE.SPLASH) {
    startSplash();
    return;
  }

  startGame();
}

function syncSettingsInputs() {
  elements.copiesPerColorInputs.forEach((input) => {
    input.checked = Number(input.value) === GENERATION.copiesPerColor;
  });
}

function rectangleCells(firstCell, secondCell) {
  const top = Math.min(firstCell.row, secondCell.row);
  const bottom = Math.max(firstCell.row, secondCell.row);
  const left = Math.min(firstCell.col, secondCell.col);
  const right = Math.max(firstCell.col, secondCell.col);

  return state.board.filter((cell) => (
    cell.row >= top &&
    cell.row <= bottom &&
    cell.col >= left &&
    cell.col <= right
  ));
}

function remainingCandyCount() {
  return state.board.filter((cell) => cell.candy !== null).length;
}

function getCellById(id) {
  return state.board.find((cell) => cell.id === id);
}

function getCellByIndex(index) {
  return state.board[index];
}

function candyLabel(key) {
  return CANDIES.find((candy) => candy.key === key)?.label || key;
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

function randomCandyKey() {
  return CANDIES[Math.floor(Math.random() * CANDIES.length)].key;
}

function shuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function loadBoardFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const grid = params.get("grid");

  if (!isValidGridString(grid)) {
    return null;
  }

  return makeBoardFromColorKeys([...grid].map((value) => (
    value === "." ? null : CANDIES[Number(value)].key
  )));
}

function updateAddressBar() {
  const url = new URL(window.location.href);

  url.searchParams.set("grid", makeGridString());
  url.hash = "";
  window.history.replaceState(null, "", url.toString());
}

function makeGridString() {
  return state.initialGrid || makeBoardGridString();
}

function makeBoardGridString() {
  return state.board.map((cell) => (
    cell.candy === null ? "." : COLOR_INDEX_BY_KEY.get(cell.candy)
  )).join("");
}

function isValidGridString(grid) {
  return typeof grid === "string" &&
    grid.length === ROWS * COLS &&
    [...grid].every((value) => value === "." || (/^[0-3]$/.test(value) && CANDIES[Number(value)]));
}

function cellId(row, col) {
  return `${row}:${col}`;
}

function cellIndex(row, col) {
  return row * COLS + col;
}

function legalMoveMasks(grid) {
  const cellsByCandy = new Map();

  grid.forEach((candy, index) => {
    if (candy === null) {
      return;
    }

    const indexes = cellsByCandy.get(candy) || [];

    indexes.push(index);
    cellsByCandy.set(candy, indexes);
  });

  return [...cellsByCandy.values()].flatMap((indexes) => {
    const moves = [];

    for (let first = 0; first < indexes.length; first += 1) {
      for (let second = first; second < indexes.length; second += 1) {
        const firstIndex = indexes[first];
        const secondIndex = indexes[second];

        moves.push({
          firstIndex,
          secondIndex,
          endpointsMask: bit(firstIndex) | bit(secondIndex),
          clearMask: rectangleMask(firstIndex, secondIndex)
        });
      }
    }

    return moves;
  });
}

function rectangleMask(firstIndex, secondIndex) {
  const firstRow = Math.floor(firstIndex / COLS);
  const firstCol = firstIndex % COLS;
  const secondRow = Math.floor(secondIndex / COLS);
  const secondCol = secondIndex % COLS;
  const top = Math.min(firstRow, secondRow);
  const bottom = Math.max(firstRow, secondRow);
  const left = Math.min(firstCol, secondCol);
  const right = Math.max(firstCol, secondCol);
  let mask = 0n;

  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      mask |= bit(cellIndex(row, col));
    }
  }

  return mask;
}

function gridMask(grid) {
  return grid.reduce((mask, candy, index) => (
    candy === null ? mask : mask | bit(index)
  ), 0n);
}

function bit(index) {
  return 1n << BigInt(index);
}

function popCount(value) {
  let count = 0;
  let remaining = value;

  while (remaining > 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }

  return count;
}
