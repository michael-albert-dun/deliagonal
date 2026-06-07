const GENERATOR_METHOD = {
  SPARSE_RANDOM: "sparse-random",
  BALANCED_SPARSE: "balanced-sparse"
};
const GENERATION = {
  method: GENERATOR_METHOD.BALANCED_SPARSE,
  rows: 6,
  cols: 6,
  copiesPerColor: 4,
  bugCount: 0,
  rejectBelowMoves: 3,
  rejectAboveMoves: 5,
  maxMilliseconds: 700,
  maxAttempts: 50000
};
const MODE = {
  SPLASH: "splash",
  PLAY: "play"
};
const DINER_THEME = {
  RED: "red",
  BLUE: "blue"
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
const BUG = "bug";

const state = {
  mode: MODE.SPLASH,
  board: [],
  initialGrid: "",
  minimumMoves: 0,
  demoMoves: [],
  history: [],
  sessionTablesSet: 0,
  sessionEfficientMoveCount: 0,
  sessionInefficientMoveCount: 0,
  sessionTablesCleared: 0,
  sessionPerfectSolutions: 0,
  tablePending: false,
  tableMessage: "",
  tableSetCounted: false,
  tableClearCounted: false,
  tablePerfectCandidate: true,
  selected: [],
  settingsOpen: false,
  bugSettingsOpen: false,
  infoOpen: false,
  billOpen: false,
  dinerTheme: DINER_THEME.RED,
  animationToken: 0,
  clearAnimationCells: new Set(),
  escapingBugs: new Map(),
  escapedBugCells: new Set()
};
let demoTimer = null;
let queuedNewTableTimer = null;

const elements = {
  playArea: document.querySelector(".play-area"),
  board: document.querySelector("#board"),
  challenge: document.querySelector("#challenge"),
  score: document.querySelector("#score"),
  newButton: document.querySelector("#new-button"),
  infoButton: document.querySelector("#info-button"),
  infoPanel: document.querySelector("#info-panel"),
  bugButton: document.querySelector("#bug-button"),
  bugPanel: document.querySelector("#bug-panel"),
  bugCountIndicator: document.querySelector("#bug-count-indicator"),
  bugCountInputs: document.querySelectorAll("[name='bug-count']"),
  undoButton: document.querySelector("#undo-button"),
  billButton: document.querySelector("#bill-button"),
  billPanel: document.querySelector("#bill-panel"),
  billTablesSet: document.querySelector("#bill-tables-set"),
  billTablesCleared: document.querySelector("#bill-tables-cleared"),
  billPerfectSolutions: document.querySelector("#bill-perfect-solutions"),
  billMoves: document.querySelector("#bill-moves"),
  billEfficiency: document.querySelector("#bill-efficiency"),
  billContinueButton: document.querySelector("#bill-continue-button"),
  billReseatButton: document.querySelector("#bill-reseat-button"),
  settingsButton: document.querySelector("#settings-button"),
  settingsPanel: document.querySelector("#settings-panel"),
  candyCountIndicator: document.querySelector("#candy-count-indicator"),
  copiesPerColorInputs: document.querySelectorAll("[name='copies-per-color']")
};

elements.board.style.setProperty("--board-cols", String(COLS));
elements.newButton.addEventListener("click", handleNewButton);
elements.infoButton.setAttribute("aria-controls", "info-panel");
elements.infoButton.setAttribute("aria-expanded", "false");
elements.infoButton.addEventListener("click", toggleInfoPanel);
elements.bugButton.setAttribute("aria-controls", "bug-panel");
elements.bugButton.setAttribute("aria-expanded", "false");
elements.bugButton.addEventListener("click", toggleBugSettingsPanel);
elements.bugCountInputs.forEach((input) => {
  input.addEventListener("change", updateBugCount);
});
elements.undoButton.addEventListener("click", undoLastDeletion);
elements.billButton.addEventListener("click", toggleBillPanel);
elements.billContinueButton.addEventListener("click", continueSession);
elements.billReseatButton.addEventListener("click", reseatSession);
elements.settingsButton.setAttribute("aria-controls", "settings-panel");
elements.settingsButton.setAttribute("aria-expanded", "false");
elements.settingsButton.addEventListener("click", toggleSettingsPanel);
elements.copiesPerColorInputs.forEach((input) => {
  input.addEventListener("change", updateCopiesPerColor);
});
document.addEventListener("keydown", handleKeyDown);
document.addEventListener("pointerdown", dismissInfoPanelOnOutsidePointerDown, true);
const urlBoard = loadBoardFromUrl();

if (urlBoard) {
  startGame({ board: urlBoard });
} else {
  startSplash();
}

function startSplash() {
  cancelQueuedNewTableRefresh();
  stopDemoLoop();
  state.mode = MODE.SPLASH;
  state.board = makeRandomBoard();
  state.initialGrid = "";
  state.minimumMoves = minimumMoveCount(state.board.map((cell) => cell.candy));
  state.demoMoves = findMinimumSolution(state.board.map((cell) => cell.candy));
  state.history = [];
  state.tablePending = false;
  state.tableSetCounted = false;
  state.tableClearCounted = false;
  state.tablePerfectCandidate = true;
  state.selected = [];
  state.settingsOpen = false;
  state.bugSettingsOpen = false;
  state.infoOpen = false;
  state.billOpen = false;
  state.animationToken += 1;
  state.clearAnimationCells.clear();
  state.escapingBugs.clear();
  state.escapedBugCells.clear();
  render();
  demoTimer = window.setTimeout(runDemoStep, 850);
}

function startGame({ board = null } = {}) {
  cancelQueuedNewTableRefresh();
  stopDemoLoop();

  let nextBoard;

  try {
    nextBoard = board || makeRandomBoard();
  } catch (error) {
    console.error(error);
    state.tablePending = true;
    state.tableMessage = "No staff available. Try again, or reduce the number of candies and/or bugs.";
    state.settingsOpen = false;
    state.bugSettingsOpen = false;
    state.infoOpen = false;
    state.billOpen = false;
    render();
    return;
  }

  state.mode = MODE.PLAY;
  state.board = nextBoard;
  state.initialGrid = makeBoardGridString();
  state.minimumMoves = minimumMoveCount(state.board.map((cell) => cell.candy));
  state.demoMoves = [];
  state.history = [];
  state.tablePending = false;
  state.tableMessage = "";
  state.tableSetCounted = false;
  state.tableClearCounted = false;
  state.tablePerfectCandidate = true;
  state.selected = [];
  state.settingsOpen = false;
  state.bugSettingsOpen = false;
  state.infoOpen = false;
  state.billOpen = false;
  state.animationToken += 1;
  state.clearAnimationCells.clear();
  state.escapingBugs.clear();
  state.escapedBugCells.clear();
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
  const deadline = Date.now() + generation.maxMilliseconds;
  let fallbackGrid = null;

  for (let attempt = 1; attempt <= generation.maxAttempts && Date.now() <= deadline; attempt += 1) {
    const grid = Array.from({ length: generation.rows * generation.cols }, () => (
      Math.random() < generation.occupancy ? randomCandyKey() : null
    ));

    if (!grid.some((candy) => candy !== null)) {
      continue;
    }

    const moves = minimumMoveCount(grid, generation.rejectAboveMoves);

    if (Number.isFinite(moves) && moves >= generation.rejectBelowMoves && fallbackGrid === null) {
      fallbackGrid = grid;
    }

    if (Number.isFinite(moves) && moves >= generation.rejectBelowMoves && moves <= generation.rejectAboveMoves) {
      return grid;
    }
  }

  if (fallbackGrid !== null) {
    return fallbackGrid;
  }

  throw new Error("Could not generate a sparse board meeting the move threshold.");
}

function makeBalancedSparseGrid(generation) {
  const candyCount = CANDIES.length * generation.copiesPerColor;

  if (candyCount + generation.bugCount > generation.rows * generation.cols) {
    throw new Error("Balanced sparse board has more candies than cells.");
  }

  const deadline = Date.now() + generation.maxMilliseconds;
  let fallbackGrid = null;

  for (let attempt = 1; attempt <= generation.maxAttempts && Date.now() <= deadline; attempt += 1) {
    const grid = Array.from({ length: generation.rows * generation.cols }, () => null);
    const bugCells = chooseBugCells(generation.rows, generation.cols, generation.bugCount);
    const cells = shuffle(
      Array.from({ length: generation.rows * generation.cols }, (_, index) => index)
        .filter((index) => !bugCells.has(index))
    ).slice(0, candyCount);
    const candies = shuffle(
      CANDIES.flatMap((candy) =>
        Array.from({ length: generation.copiesPerColor }, () => candy.key)
      )
    );

    bugCells.forEach((cell) => {
      grid[cell] = BUG;
    });
    cells.forEach((cell, index) => {
      grid[cell] = candies[index];
    });

    const moves = minimumMoveCount(grid, generation.rejectAboveMoves);

    if (Number.isFinite(moves) && moves >= generation.rejectBelowMoves && fallbackGrid === null) {
      fallbackGrid = grid;
    }

    if (Number.isFinite(moves) && moves >= generation.rejectBelowMoves && moves <= generation.rejectAboveMoves) {
      return grid;
    }
  }

  if (fallbackGrid !== null) {
    return fallbackGrid;
  }

  throw new Error("Could not generate a balanced sparse board meeting the move threshold.");
}

function isAcceptedMoveCount(grid, generation) {
  const moves = minimumMoveCount(grid);

  return moves >= generation.rejectBelowMoves && moves <= generation.rejectAboveMoves;
}

function chooseBugCells(rows, cols, bugCount) {
  if (bugCount === 0) {
    return new Set();
  }

  const interiorCells = [];

  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      interiorCells.push(cellIndex(row, col));
    }
  }

  for (let attempt = 1; attempt <= 10000; attempt += 1) {
    const bugs = new Set();

    for (const cell of shuffle(interiorCells)) {
      if ([...bugs].every((bug) => !areTouching(cell, bug))) {
        bugs.add(cell);
      }

      if (bugs.size === bugCount) {
        return bugs;
      }
    }
  }

  throw new Error("Could not place non-adjacent interior bugs.");
}

function areTouching(first, second) {
  const firstRow = Math.floor(first / COLS);
  const firstCol = first % COLS;
  const secondRow = Math.floor(second / COLS);
  const secondCol = second % COLS;

  return Math.abs(firstRow - secondRow) <= 1 && Math.abs(firstCol - secondCol) <= 1;
}

function minimumMoveCount(grid, maxDepth = ROWS * COLS) {
  const initialMask = gridMask(grid);
  const moves = legalMoveMasks(grid);
  const depthLimit = Math.min(maxDepth, ROWS * COLS);

  for (let depth = 0; depth <= depthLimit; depth += 1) {
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

function makeEmptyBoard() {
  return makeBoardFromColorKeys(Array.from({ length: ROWS * COLS }, () => null));
}

function render() {
  elements.playArea.classList.toggle("is-splash", state.mode === MODE.SPLASH);
  elements.playArea.classList.toggle("is-blue-diner", state.dinerTheme === DINER_THEME.BLUE);
  elements.board.innerHTML = "";

  state.board.forEach((cell) => {
    const tile = document.createElement("button");

    tile.type = "button";
    tile.className = tileClassName(cell);
    tile.disabled = state.mode === MODE.SPLASH || cell.candy === null || cell.candy === BUG;
    tile.dataset.id = cell.id;
    tile.setAttribute("aria-label", tileAriaLabel(cell));
    tile.addEventListener("click", () => selectCell(cell));

    if (cell.candy !== null && !state.escapedBugCells.has(cell.id)) {
      const candy = document.createElement("span");

      candy.className = cell.candy === BUG ? "bug" : `candy candy-${cell.candy}`;
      candy.setAttribute("aria-hidden", "true");
      tile.append(candy);
    }

    elements.board.append(tile);
  });

  if (state.tablePending && state.tableMessage !== "") {
    const message = document.createElement("p");

    message.className = "board-message";
    message.textContent = state.tableMessage;
    message.setAttribute("aria-live", "polite");
    elements.board.append(message);
  }

  const score = scoreDisplay();

  elements.challenge.textContent = challengeText();
  elements.score.textContent = score.text;
  elements.score.classList.toggle("is-on-track", score.onTrack);
  elements.score.classList.toggle("is-off-track", score.offTrack);
  elements.undoButton.disabled = state.mode !== MODE.PLAY ||
    (state.selected.length === 0 && state.history.length === 0);
  elements.newButton.textContent = state.mode === MODE.SPLASH ? "Play" : "";
  elements.newButton.setAttribute(
    "aria-label",
    state.mode === MODE.SPLASH ? "Play" : "New table"
  );
  elements.infoPanel.hidden = state.mode === MODE.SPLASH || !state.infoOpen;
  elements.infoButton.setAttribute("aria-expanded", String(state.infoOpen));
  elements.bugPanel.hidden = state.mode === MODE.SPLASH || !state.bugSettingsOpen;
  elements.bugButton.setAttribute("aria-expanded", String(state.bugSettingsOpen));
  elements.bugCountIndicator.textContent = String(GENERATION.bugCount);
  elements.billPanel.hidden = state.mode === MODE.SPLASH || !state.billOpen;
  elements.billButton.setAttribute("aria-expanded", String(state.billOpen));
  renderBill();
  elements.settingsPanel.hidden = !state.settingsOpen;
  elements.settingsButton.setAttribute("aria-expanded", String(state.settingsOpen));
  elements.candyCountIndicator.textContent = String(GENERATION.copiesPerColor);
  syncSettingsInputs();
}

function challengeText() {
  if (state.mode === MODE.SPLASH) {
    return "";
  }

  return "";
}

function scoreDisplay() {
  if (state.mode === MODE.SPLASH || state.tablePending) {
    return { text: "", onTrack: false, offTrack: false };
  }

  const movesRemaining = currentMinimumMovesRemaining();
  const onOptimalPath = isOptimalPath(state.history.length, displayCandyGrid());

  return {
    text: String(movesRemaining),
    onTrack: onOptimalPath,
    offTrack: !onOptimalPath
  };
}

function currentMinimumMovesRemaining() {
  return minimumMoveCount(displayCandyGrid());
}

function displayCandyGrid() {
  return state.board.map((cell) => (
    state.clearAnimationCells.has(cell.id) && cell.candy !== BUG
      ? null
      : cell.candy
  ));
}

function isOptimalPath(moveCount, grid) {
  return moveCount + minimumMoveCount(grid) === state.minimumMoves;
}

function recordSessionMove(clearedCells) {
  const currentGrid = state.board.map((cell) => cell.candy);
  const currentMovesRemaining = minimumMoveCount(currentGrid);
  const wasOnOptimalPath = isOptimalPath(state.history.length, currentGrid);
  const clearedIds = new Set(clearedCells.map((cell) => cell.id));
  const nextGrid = state.board.map((cell) => (
    clearedIds.has(cell.id) && cell.candy !== BUG
      ? null
      : cell.candy
  ));
  const nextMovesRemaining = minimumMoveCount(nextGrid);
  const remainsOnOptimalPath = isOptimalPath(state.history.length + 1, nextGrid);
  const efficient = nextMovesRemaining < currentMovesRemaining;

  recordTableSet();

  if (efficient) {
    state.sessionEfficientMoveCount += 1;
  } else {
    state.sessionInefficientMoveCount += 1;
  }

  if (!efficient || !wasOnOptimalPath || !remainsOnOptimalPath) {
    state.tablePerfectCandidate = false;
  }

  return { efficient };
}

function recordTableSet() {
  if (state.mode !== MODE.PLAY || state.tableSetCounted) {
    return;
  }

  state.sessionTablesSet += 1;
  state.tableSetCounted = true;
}

function tileClassName(cell) {
  const escapingBug = state.escapingBugs.get(cell.id);
  const escapedBug = state.escapedBugCells.has(cell.id);

  return [
    "tile",
    cell.candy === null || escapedBug ? "is-empty" : null,
    cell.candy === BUG && !escapedBug ? "is-bug" : null,
    escapingBug ? "is-bug-escaping" : null,
    escapingBug ? `is-bug-escaping-${escapingBug}` : null,
    state.selected.includes(cell.id) ? "is-selected" : null,
    state.clearAnimationCells.has(cell.id) ? "is-clearing" : null
  ].filter(Boolean).join(" ");
}

function tileAriaLabel(cell) {
  const position = `row ${cell.row + 1}, column ${cell.col + 1}`;

  if (cell.candy === null || state.escapedBugCells.has(cell.id)) {
    return `Empty tile at ${position}`;
  }

  if (cell.candy === BUG) {
    return `Bug at ${position}`;
  }

  return `${candyLabel(cell.candy)} candy at ${position}`;
}

function selectCell(cell) {
  if (state.mode !== MODE.PLAY) {
    return;
  }

  if (cell.candy === null || cell.candy === BUG) {
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

  if (canClearRectangle(firstCell, cell)) {
    clearRectangle(firstCell, cell);
  }
}

function clearRectangle(firstCell, secondCell) {
  const cells = rectangleCells(firstCell, secondCell);
  const moveRecord = recordSessionMove(cells);
  const restoredCells = cells
    .filter((cell) => cell.candy !== null)
    .map((cell) => ({ id: cell.id, candy: cell.candy }));

  state.history.push({ restoredCells, efficient: moveRecord.efficient });
  clearCellsWithFade(cells, () => {
    recordTableCleared();

    if (state.mode === MODE.PLAY) {
      render();
    }
  });
}

function canClearRectangle(firstCell, secondCell) {
  return rectangleCells(firstCell, secondCell)
    .every((cell) => cell.candy !== BUG);
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

  reverseTableClearIfUndoingFromEmpty();
  refundMoveIfUndoable(action);
  const restoredCandyById = new Map(action.restoredCells.map((cell) => [cell.id, cell.candy]));

  state.board = state.board.map((cell) => (
    restoredCandyById.has(cell.id) ? { ...cell, candy: restoredCandyById.get(cell.id) } : cell
  ));
  state.selected = [];
  state.clearAnimationCells.clear();
  state.escapingBugs.clear();
  state.escapedBugCells.clear();
  render();
}

function recordTableCleared() {
  if (state.mode !== MODE.PLAY || state.tableClearCounted || remainingCandyCount() !== 0) {
    return;
  }

  state.sessionTablesCleared += 1;

  if (state.tablePerfectCandidate) {
    state.sessionPerfectSolutions += 1;
  }

  state.tableClearCounted = true;
}

function billSummary() {
  const totalMoves = state.sessionEfficientMoveCount + state.sessionInefficientMoveCount;
  const efficiencyPercent = totalMoves === 0
    ? 0
    : Math.round((state.sessionEfficientMoveCount / totalMoves) * 100);

  return {
    tablesSet: state.sessionTablesSet,
    tablesCleared: state.sessionTablesCleared,
    perfectSolutions: state.sessionPerfectSolutions,
    moves: totalMoves,
    efficiency: {
      effectiveMoves: state.sessionEfficientMoveCount,
      totalMoves,
      percent: efficiencyPercent
    }
  };
}

function renderBill() {
  const bill = billSummary();

  elements.billTablesSet.textContent = String(bill.tablesSet);
  elements.billTablesCleared.textContent = String(bill.tablesCleared);
  elements.billPerfectSolutions.textContent = String(bill.perfectSolutions);
  elements.billMoves.textContent = String(bill.moves);
  elements.billEfficiency.textContent =
    `${bill.efficiency.effectiveMoves}/${bill.efficiency.totalMoves} (${bill.efficiency.percent}%)`;
}

function refundMoveIfUndoable(action) {
  if (!action.efficient) {
    return;
  }

  state.sessionEfficientMoveCount = Math.max(0, state.sessionEfficientMoveCount - 1);
}

function reverseTableClearIfUndoingFromEmpty() {
  if (!state.tableClearCounted || remainingCandyCount() !== 0) {
    return;
  }

  state.sessionTablesCleared = Math.max(0, state.sessionTablesCleared - 1);

  if (state.tablePerfectCandidate) {
    state.sessionPerfectSolutions = Math.max(0, state.sessionPerfectSolutions - 1);
  }

  state.tableClearCounted = false;
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
    scuttleBugsIfBoardCleared(animationToken);
    afterClear();
  }, 360);
}

function scuttleBugsIfBoardCleared(animationToken) {
  if (remainingCandyCount() !== 0 || state.escapingBugs.size > 0) {
    return;
  }

  const bugs = state.board.filter((cell) => (
    cell.candy === BUG && !state.escapedBugCells.has(cell.id)
  ));

  if (bugs.length === 0) {
    return;
  }

  state.escapingBugs = new Map(bugs.map((cell) => [cell.id, bugEscapeDirection(cell)]));
  render();

  window.setTimeout(() => {
    if (animationToken !== state.animationToken) {
      return;
    }

    state.escapingBugs.clear();
    state.escapedBugCells = new Set(bugs.map((cell) => cell.id));
    render();
  }, 1200);
}

function bugEscapeDirection(cell) {
  const distances = [
    { direction: "up", distance: cell.row },
    { direction: "right", distance: COLS - 1 - cell.col },
    { direction: "down", distance: ROWS - 1 - cell.row },
    { direction: "left", distance: cell.col }
  ];
  const nearestDistance = Math.min(...distances.map(({ distance }) => distance));
  const nearestEdges = distances.filter(({ distance }) => distance === nearestDistance);

  return nearestEdges[(cell.row + cell.col) % nearestEdges.length].direction;
}

function stopDemoLoop() {
  if (demoTimer !== null) {
    window.clearTimeout(demoTimer);
    demoTimer = null;
  }
}

function queueNewTableRefresh() {
  cancelQueuedNewTableRefresh();
  queuedNewTableTimer = window.setTimeout(runQueuedNewTableRefresh, 300);
}

function runQueuedNewTableRefresh() {
  queuedNewTableTimer = null;

  if (state.settingsOpen || state.bugSettingsOpen) {
    queueNewTableRefresh();
    return;
  }

  if (state.mode === MODE.SPLASH) {
    startSplash();
    return;
  }

  startGame();
}

function handleNewButton() {
  if (state.mode === MODE.SPLASH) {
    startGame();
    return;
  }

  preparePendingTableRefresh();
  queueNewTableRefresh();
  render();
}

function preparePendingTableRefresh() {
  stopDemoLoop();
  state.mode = MODE.PLAY;
  state.board = makeEmptyBoard();
  state.initialGrid = "";
  state.minimumMoves = 0;
  state.demoMoves = [];
  state.history = [];
  state.tablePending = true;
  state.tableMessage = "Finding table...";
  state.tableSetCounted = false;
  state.tableClearCounted = false;
  state.tablePerfectCandidate = true;
  state.selected = [];
  state.infoOpen = false;
  state.clearAnimationCells.clear();
  state.escapingBugs.clear();
  state.escapedBugCells.clear();
}

function cancelQueuedNewTableRefresh() {
  if (queuedNewTableTimer === null) {
    return;
  }

  window.clearTimeout(queuedNewTableTimer);
  queuedNewTableTimer = null;
}

function toggleSettingsPanel() {
  state.settingsOpen = !state.settingsOpen;
  state.bugSettingsOpen = false;
  state.infoOpen = false;
  state.billOpen = false;
  render();
}

function toggleBugSettingsPanel() {
  state.bugSettingsOpen = !state.bugSettingsOpen;
  state.settingsOpen = false;
  state.infoOpen = false;
  state.billOpen = false;
  render();
}

function toggleInfoPanel() {
  state.infoOpen = !state.infoOpen;
  state.settingsOpen = false;
  state.bugSettingsOpen = false;
  state.billOpen = false;
  render();
}

function dismissInfoPanelOnOutsidePointerDown(event) {
  if (!state.infoOpen) {
    return;
  }

  if (elements.infoPanel.contains(event.target) || elements.infoButton.contains(event.target)) {
    return;
  }

  state.infoOpen = false;
  render();
}

function toggleBillPanel() {
  state.billOpen = !state.billOpen;
  state.settingsOpen = false;
  state.bugSettingsOpen = false;
  state.infoOpen = false;
  render();
}

function continueSession() {
  state.billOpen = false;
  render();
}

function reseatSession() {
  resetSessionBill();
  toggleDinerTheme();
  startGame();
}

function toggleDinerTheme() {
  state.dinerTheme = state.dinerTheme === DINER_THEME.RED
    ? DINER_THEME.BLUE
    : DINER_THEME.RED;
}

function resetSessionBill() {
  state.sessionTablesSet = 0;
  state.sessionTablesCleared = 0;
  state.sessionPerfectSolutions = 0;
  state.sessionEfficientMoveCount = 0;
  state.sessionInefficientMoveCount = 0;
}

function handleKeyDown(event) {
  if (event.key.toLowerCase() !== "i" || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (state.mode === MODE.SPLASH) {
    return;
  }

  event.preventDefault();
  toggleInfoPanel();
}

function updateCopiesPerColor(event) {
  GENERATION.copiesPerColor = Number(event.target.value);
  state.settingsOpen = false;
  state.billOpen = false;

  preparePendingTableRefresh();
  queueNewTableRefresh();
  render();
}

function updateBugCount(event) {
  GENERATION.bugCount = Number(event.target.value);
  state.bugSettingsOpen = false;
  state.billOpen = false;

  preparePendingTableRefresh();
  queueNewTableRefresh();
  render();
}

function syncSettingsInputs() {
  elements.copiesPerColorInputs.forEach((input) => {
    input.checked = Number(input.value) === GENERATION.copiesPerColor;
  });
  elements.bugCountInputs.forEach((input) => {
    input.checked = Number(input.value) === GENERATION.bugCount;
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
  return state.board.filter((cell) => cell.candy !== null && cell.candy !== BUG).length;
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
    value === "." ? null : value === "b" ? BUG : CANDIES[Number(value)].key
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
    cell.candy === null ? "." : cell.candy === BUG ? "b" : COLOR_INDEX_BY_KEY.get(cell.candy)
  )).join("");
}

function isValidGridString(grid) {
  return typeof grid === "string" &&
    grid.length === ROWS * COLS &&
    [...grid].every((value) => value === "." || value === "b" || (/^[0-3]$/.test(value) && CANDIES[Number(value)]));
}

function cellId(row, col) {
  return `${row}:${col}`;
}

function cellIndex(row, col) {
  return row * COLS + col;
}

function legalMoveMasks(grid) {
  const cellsByCandy = new Map();
  const bugMask = grid.reduce((mask, candy, index) => (
    candy === BUG ? mask | bit(index) : mask
  ), 0n);

  grid.forEach((candy, index) => {
    if (candy === null || candy === BUG) {
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

        const clearMask = rectangleMask(firstIndex, secondIndex);

        if ((clearMask & bugMask) !== 0n) {
          continue;
        }

        moves.push({
          firstIndex,
          secondIndex,
          endpointsMask: bit(firstIndex) | bit(secondIndex),
          clearMask
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
    candy === null || candy === BUG ? mask : mask | bit(index)
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
