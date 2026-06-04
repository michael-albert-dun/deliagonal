#!/usr/bin/env node

const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 6;
const DEFAULT_COLOR_COUNT = 4;
const DEFAULT_TRIALS = 100;
const DEFAULT_SEED = 12345;
const DEFAULT_OCCUPANCY = 2 / 3;
const ROCK = -1;
const GENERATOR_METHOD = {
  UNIFORM: "uniform",
  FILLED_CONSTRAINED: "filled-constrained",
  SPARSE_RANDOM: "sparse-random",
  BALANCED_SPARSE: "balanced-sparse"
};

const options = parseArgs(process.argv.slice(2));
const rng = mulberry32(options.seed);
const geometry = buildGeometry(options.rows, options.cols);
const histogram = new Map();
let totalMoves = 0;
let totalVisitedStates = 0;
let maxVisitedStates = 0;
let threeMoveBoards = 0;
let threeMoveBoardsWithSingleCornerFirst = 0;

for (let trial = 1; trial <= options.trials; trial += 1) {
  const board = options.generator === GENERATOR_METHOD.FILLED_CONSTRAINED
    ? makeConstrainedRandomBoard(options.rows, options.cols, options.colorCount, rng)
    : options.generator === GENERATOR_METHOD.SPARSE_RANDOM
      ? makeSparseRandomBoard(options.rows, options.cols, options.colorCount, options.occupancy, rng)
      : options.generator === GENERATOR_METHOD.BALANCED_SPARSE
        ? options.rocks > 0
          ? makeBalancedSparseBoardWithRocks(options.rows, options.cols, options.colorCount, options.copiesPerColor, options.rocks, rng)
          : makeBalancedSparseBoard(options.rows, options.cols, options.colorCount, options.copiesPerColor, rng)
    : makeRandomBoard(options.rows, options.cols, options.colorCount, rng);
  const initialMask = boardMask(board);
  const moves = buildMoves(board, geometry, options);
  const result = minimumMoveCount(moves, initialMask);

  histogram.set(result.depth, (histogram.get(result.depth) || 0) + 1);
  totalMoves += result.depth;
  totalVisitedStates += result.visitedStates;
  maxVisitedStates = Math.max(maxVisitedStates, result.visitedStates);

  if (options.analyzeSingleCornerFirst && result.depth === 3) {
    threeMoveBoards += 1;

    if (hasOptimalSingleCornerFirstMove(moves, initialMask, result.depth, geometry.cornerCells)) {
      threeMoveBoardsWithSingleCornerFirst += 1;
    }
  }

  if (options.verbose) {
    console.log(`trial ${trial}: ${result.depth} moves, ${result.visitedStates} states`);
  }
}

printSummary({
  histogram,
  trials: options.trials,
  rows: options.rows,
  cols: options.cols,
  colorCount: options.colorCount,
  seed: options.seed,
  forbidBoundaryPairs: options.forbidBoundaryPairs,
  requireFullRectangle: options.requireFullRectangle,
  generator: options.generator,
  occupancy: options.occupancy,
  copiesPerColor: options.copiesPerColor,
  rocks: options.rocks,
  analyzeSingleCornerFirst: options.analyzeSingleCornerFirst,
  threeMoveBoards,
  threeMoveBoardsWithSingleCornerFirst,
  averageMoves: totalMoves / options.trials,
  averageVisitedStates: totalVisitedStates / options.trials,
  maxVisitedStates
});

function minimumMoveCount(moves, initialMask) {
  for (let depth = 0; depth <= 36; depth += 1) {
    const stats = {
      searchedStates: 0,
      popCountCache: new Map(),
      requireFullRectangle: options.requireFullRectangle
    };
    const failed = new Set();

    if (canClearWithin(moves, initialMask, depth, failed, stats)) {
      return { depth, visitedStates: stats.searchedStates };
    }
  }

  throw new Error("No solution found within 36 moves; single-cell clears should make every board solvable.");
}

function hasOptimalSingleCornerFirstMove(moves, initialMask, depth, cornerCells) {
  return moves
    .filter((move) => (
      move.firstIndex === move.secondIndex &&
      cornerCells.has(move.firstIndex)
    ))
    .some((move) => {
      const nextMask = initialMask & ~move.clearMask;
      const stats = {
        searchedStates: 0,
        popCountCache: new Map(),
        requireFullRectangle: options.requireFullRectangle
      };

      return canClearWithin(moves, nextMask, depth - 1, new Set(), stats);
    });
}

function canClearWithin(moves, mask, depthLeft, failed, stats) {
  stats.searchedStates += 1;

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

  const nextMasks = nextMasksByClearSize(moves, mask, stats);

  if (nextMasks.length === 0 || popCount(mask, stats) > depthLeft * nextMasks[0].clearedCount) {
    failed.add(cacheKey);
    return false;
  }

  for (const { nextMask } of nextMasks) {
    if (canClearWithin(moves, nextMask, depthLeft - 1, failed, stats)) {
      return true;
    }
  }

  failed.add(cacheKey);
  return false;
}

function nextMasksByClearSize(moves, mask, stats) {
  const bestByMask = new Map();

  moves.forEach((move) => {
    if ((mask & move.endpointsMask) !== move.endpointsMask) {
      return;
    }

    if (stats.requireFullRectangle && (mask & move.clearMask) !== move.clearMask) {
      return;
    }

    const nextMask = mask & ~move.clearMask;
    const clearedCount = popCount(mask ^ nextMask, stats);
    const existing = bestByMask.get(nextMask);

    if (!existing || clearedCount > existing.clearedCount) {
      bestByMask.set(nextMask, { nextMask, clearedCount });
    }
  });

  return [...bestByMask.values()].sort((a, b) => b.clearedCount - a.clearedCount);
}

function buildMoves(board, geometry, options) {
  const cellsByColor = Array.from({ length: options.colorCount }, () => []);
  const rockMask = boardRockMask(board);

  board.forEach((color, index) => {
    if (color === null || color === ROCK) {
      return;
    }

    cellsByColor[color].push(index);
  });

  return cellsByColor.flatMap((cells) => {
    const moves = [];

    for (let first = 0; first < cells.length; first += 1) {
      for (let second = first; second < cells.length; second += 1) {
        const firstIndex = cells[first];
        const secondIndex = cells[second];

        if (
          options.forbidBoundaryPairs &&
          firstIndex !== secondIndex &&
          geometry.boundaryCells.has(firstIndex) &&
          geometry.boundaryCells.has(secondIndex)
        ) {
          continue;
        }

        const clearMask = geometry.rectangleMasks[firstIndex][secondIndex];

        if ((clearMask & rockMask) !== 0n) {
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

function buildGeometry(rows, cols) {
  const cellCount = rows * cols;
  const rectangleMasks = Array.from(
    { length: cellCount },
    () => Array.from({ length: cellCount }, () => 0n)
  );
  const boundaryCells = new Set();
  const cornerCells = new Set([
    0,
    cols - 1,
    (rows - 1) * cols,
    rows * cols - 1
  ]);

  for (let index = 0; index < cellCount; index += 1) {
    const row = Math.floor(index / cols);
    const col = index % cols;

    if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
      boundaryCells.add(index);
    }
  }

  for (let first = 0; first < cellCount; first += 1) {
    for (let second = first; second < cellCount; second += 1) {
      const mask = rectangleMask(first, second, rows, cols);

      rectangleMasks[first][second] = mask;
      rectangleMasks[second][first] = mask;
    }
  }

  return { rectangleMasks, boundaryCells, cornerCells };
}

function rectangleMask(first, second, rows, cols) {
  const firstRow = Math.floor(first / cols);
  const firstCol = first % cols;
  const secondRow = Math.floor(second / cols);
  const secondCol = second % cols;
  const top = Math.min(firstRow, secondRow);
  const bottom = Math.max(firstRow, secondRow);
  const left = Math.min(firstCol, secondCol);
  const right = Math.max(firstCol, secondCol);
  let mask = 0n;

  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      mask |= bit(row * cols + col);
    }
  }

  return mask;
}

function makeRandomBoard(rows, cols, colorCount, rng) {
  return Array.from({ length: rows * cols }, () => Math.floor(rng() * colorCount));
}

function makeSparseRandomBoard(rows, cols, colorCount, occupancy, rng) {
  for (let attempt = 1; attempt <= 10000; attempt += 1) {
    const board = Array.from({ length: rows * cols }, () => (
      rng() < occupancy ? Math.floor(rng() * colorCount) : null
    ));

    if (board.some((color) => color !== null) && !hasSolutionWithinTwoMoves(board, rows, cols, colorCount)) {
      return board;
    }
  }

  throw new Error("Could not generate a sparse board without a two-move solution.");
}

function makeBalancedSparseBoard(rows, cols, colorCount, copiesPerColor, rng) {
  const candyCount = colorCount * copiesPerColor;

  if (candyCount > rows * cols) {
    throw new Error("Balanced sparse board has more candies than cells.");
  }

  for (let attempt = 1; attempt <= 10000; attempt += 1) {
    const board = Array.from({ length: rows * cols }, () => null);
    const cells = shuffle(
      Array.from({ length: rows * cols }, (_, index) => index),
      rng
    ).slice(0, candyCount);
    const colors = shuffle(
      Array.from({ length: colorCount }, (_, color) =>
        Array.from({ length: copiesPerColor }, () => color)
      ).flat(),
      rng
    );

    cells.forEach((cell, index) => {
      board[cell] = colors[index];
    });

    if (!hasSolutionWithinTwoMoves(board, rows, cols, colorCount)) {
      return board;
    }
  }

  throw new Error("Could not generate a balanced sparse board without a two-move solution.");
}

function makeBalancedSparseBoardWithRocks(rows, cols, colorCount, copiesPerColor, rockCount, rng) {
  const candyCount = colorCount * copiesPerColor;

  if (candyCount + rockCount > rows * cols) {
    throw new Error("Balanced sparse board with rocks has more pieces than cells.");
  }

  for (let attempt = 1; attempt <= 10000; attempt += 1) {
    const rockCells = chooseRockCells(rows, cols, rockCount, rng);
    const board = Array.from({ length: rows * cols }, () => null);
    const availableCells = Array.from({ length: rows * cols }, (_, index) => index)
      .filter((index) => !rockCells.has(index));
    const candyCells = shuffle(availableCells, rng).slice(0, candyCount);
    const colors = shuffle(
      Array.from({ length: colorCount }, (_, color) =>
        Array.from({ length: copiesPerColor }, () => color)
      ).flat(),
      rng
    );

    rockCells.forEach((cell) => {
      board[cell] = ROCK;
    });
    candyCells.forEach((cell, index) => {
      board[cell] = colors[index];
    });

    if (!hasSolutionWithinTwoMoves(board, rows, cols, colorCount)) {
      return board;
    }
  }

  throw new Error("Could not generate a balanced sparse board with rocks without a two-move solution.");
}

function chooseRockCells(rows, cols, rockCount, rng) {
  const interiorCells = [];

  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      interiorCells.push(cellIndex(row, col, cols));
    }
  }

  for (let attempt = 1; attempt <= 10000; attempt += 1) {
    const rocks = new Set();

    for (const cell of shuffle(interiorCells, rng)) {
      if ([...rocks].every((rock) => !areTouching(cell, rock, cols))) {
        rocks.add(cell);
      }

      if (rocks.size === rockCount) {
        return rocks;
      }
    }
  }

  throw new Error("Could not place non-adjacent interior rocks.");
}

function areTouching(first, second, cols) {
  const firstRow = Math.floor(first / cols);
  const firstCol = first % cols;
  const secondRow = Math.floor(second / cols);
  const secondCol = second % cols;

  return Math.abs(firstRow - secondRow) <= 1 && Math.abs(firstCol - secondCol) <= 1;
}

function makeConstrainedRandomBoard(rows, cols, colorCount, rng) {
  if (colorCount < 4) {
    throw new Error("The constrained generator needs at least four colours for distinct corners.");
  }

  for (let attempt = 1; attempt <= 1000; attempt += 1) {
    const board = makeConstrainedRandomBoardCandidate(rows, cols, colorCount, rng);

    if (!hasOneOrTwoMoveSolution(board, rows, cols)) {
      return board;
    }
  }

  return makeConstrainedRandomBoardCandidate(rows, cols, colorCount, rng);
}

function makeConstrainedRandomBoardCandidate(rows, cols, colorCount, rng) {
  const board = makeRandomBoard(rows, cols, colorCount, rng);
  const corners = shuffle(
    Array.from({ length: colorCount }, (_, index) => index),
    rng
  ).slice(0, 4);
  const topLeft = cellIndex(0, 0, cols);
  const topRight = cellIndex(0, cols - 1, cols);
  const bottomLeft = cellIndex(rows - 1, 0, cols);
  const bottomRight = cellIndex(rows - 1, cols - 1, cols);

  board[topLeft] = corners[0];
  board[topRight] = corners[1];
  board[bottomLeft] = corners[2];
  board[bottomRight] = corners[3];

  for (let attempt = 1; attempt <= 1000; attempt += 1) {
    fillConstrainedSides(board, rows, cols, colorCount, rng, topLeft, topRight, bottomLeft, bottomRight);

    if (!hasOneOrTwoMoveSolution(board, rows, cols)) {
      return board;
    }
  }

  return board;
}

function fillConstrainedSides(board, rows, cols, colorCount, rng, topLeft, topRight, bottomLeft, bottomRight) {
  fillSideAvoidingPair(board, sideIndexes("bottom", rows, cols), [board[topLeft], board[topRight]], colorCount, rng);
  fillSideAvoidingPair(board, sideIndexes("top", rows, cols), [board[bottomLeft], board[bottomRight]], colorCount, rng);
  fillSideAvoidingPair(board, sideIndexes("right", rows, cols), [board[topLeft], board[bottomLeft]], colorCount, rng);
  fillSideAvoidingPair(board, sideIndexes("left", rows, cols), [board[topRight], board[bottomRight]], colorCount, rng);
}

function hasOneOrTwoMoveSolution(board, rows, cols) {
  if (isOneMoveClearable(board, 0, rows - 1, 0, cols - 1, cols)) {
    return true;
  }

  for (let row = 0; row < rows - 1; row += 1) {
    if (
      isOneMoveClearable(board, 0, row, 0, cols - 1, cols) &&
      isOneMoveClearable(board, row + 1, rows - 1, 0, cols - 1, cols)
    ) {
      return true;
    }
  }

  for (let col = 0; col < cols - 1; col += 1) {
    if (
      isOneMoveClearable(board, 0, rows - 1, 0, col, cols) &&
      isOneMoveClearable(board, 0, rows - 1, col + 1, cols - 1, cols)
    ) {
      return true;
    }
  }

  return false;
}

function isOneMoveClearable(board, top, bottom, left, right, cols) {
  const topLeft = board[cellIndex(top, left, cols)];
  const topRight = board[cellIndex(top, right, cols)];
  const bottomLeft = board[cellIndex(bottom, left, cols)];
  const bottomRight = board[cellIndex(bottom, right, cols)];

  return (topLeft !== null && topLeft === bottomRight) ||
    (topRight !== null && topRight === bottomLeft);
}

function hasSolutionWithinTwoMoves(board, rows, cols, colorCount) {
  const geometry = buildGeometry(rows, cols);
  const initialMask = boardMask(board);
  const moves = buildMoves(board, geometry, {
    colorCount,
    forbidBoundaryPairs: false
  });

  return minimumMoveCount(moves, initialMask).depth <= 2;
}

function fillSideAvoidingPair(board, indexes, forbiddenPair, colorCount, rng) {
  do {
    for (let position = 1; position < indexes.length - 1; position += 1) {
      const previous = board[indexes[position - 1]];
      const candidates = Array.from({ length: colorCount }, (_, color) => color)
        .filter((color) => previous !== forbiddenPair[0] || color !== forbiddenPair[1]);

      board[indexes[position]] = randomItem(candidates, rng);
    }
  } while (hasForbiddenAdjacentPair(board, indexes, forbiddenPair));
}

function hasForbiddenAdjacentPair(board, indexes, forbiddenPair) {
  return indexes.some((index, position) => (
    position > 0 &&
    board[indexes[position - 1]] === forbiddenPair[0] &&
    board[index] === forbiddenPair[1]
  ));
}

function sideIndexes(side, rows, cols) {
  if (side === "top") {
    return Array.from({ length: cols }, (_, col) => cellIndex(0, col, cols));
  }

  if (side === "bottom") {
    return Array.from({ length: cols }, (_, col) => cellIndex(rows - 1, col, cols));
  }

  if (side === "left") {
    return Array.from({ length: rows }, (_, row) => cellIndex(row, 0, cols));
  }

  return Array.from({ length: rows }, (_, row) => cellIndex(row, cols - 1, cols));
}

function printSummary(summary) {
  console.log(`CandyClear minimum move distribution`);
  console.log(`grid: ${summary.rows}x${summary.cols}`);
  console.log(`colours: ${summary.colorCount}`);
  console.log(`forbid boundary pairs: ${summary.forbidBoundaryPairs ? "yes" : "no"}`);
  console.log(`require full rectangles: ${summary.requireFullRectangle ? "yes" : "no"}`);
  console.log(`generator: ${summary.generator}`);
  if (summary.generator === GENERATOR_METHOD.SPARSE_RANDOM) {
    console.log(`occupancy: ${summary.occupancy}`);
  } else if (summary.generator === GENERATOR_METHOD.BALANCED_SPARSE) {
    console.log(`copies per colour: ${summary.copiesPerColor}`);
  }
  console.log(`rocks: ${summary.rocks}`);
  console.log(`trials: ${summary.trials}`);
  console.log(`seed: ${summary.seed}`);
  console.log("");
  console.log("moves,count,percent");

  [...summary.histogram.keys()].sort((a, b) => a - b).forEach((moves) => {
    const count = summary.histogram.get(moves);
    const percent = (count / summary.trials * 100).toFixed(2);

    console.log(`${moves},${count},${percent}`);
  });

  console.log("");
  console.log(`average moves: ${summary.averageMoves.toFixed(3)}`);
  console.log(`average visited states: ${summary.averageVisitedStates.toFixed(1)}`);
  console.log(`max visited states: ${summary.maxVisitedStates}`);

  if (summary.analyzeSingleCornerFirst) {
    const count = summary.threeMoveBoardsWithSingleCornerFirst;
    const total = summary.threeMoveBoards;
    const percent = total === 0 ? "0.00" : (count / total * 100).toFixed(2);

    console.log("");
    console.log(`3-move boards with optimal single-corner first move: ${count}/${total} (${percent}%)`);
  }
}

function bit(index) {
  return 1n << BigInt(index);
}

function boardMask(board) {
  return board.reduce((mask, color, index) => (
    color === null || color === ROCK ? mask : mask | bit(index)
  ), 0n);
}

function boardRockMask(board) {
  return board.reduce((mask, color, index) => (
    color === ROCK ? mask | bit(index) : mask
  ), 0n);
}

function cellIndex(row, col, cols) {
  return row * cols + col;
}

function popCount(value, stats = null) {
  const cached = stats?.popCountCache.get(value);

  if (cached !== undefined) {
    return cached;
  }

  let count = 0;
  let remaining = value;

  while (remaining > 0n) {
    remaining &= remaining - 1n;
    count += 1;
  }

  stats?.popCountCache.set(value, count);
  return count;
}

function parseArgs(args) {
  const options = {
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    colorCount: DEFAULT_COLOR_COUNT,
    trials: DEFAULT_TRIALS,
    seed: DEFAULT_SEED,
    forbidBoundaryPairs: false,
    requireFullRectangle: false,
    generator: GENERATOR_METHOD.UNIFORM,
    occupancy: DEFAULT_OCCUPANCY,
    copiesPerColor: 3,
    rocks: 0,
    analyzeSingleCornerFirst: false,
    verbose: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--rows") {
      options.rows = readPositiveInteger(next, "--rows");
      index += 1;
    } else if (arg === "--cols") {
      options.cols = readPositiveInteger(next, "--cols");
      index += 1;
    } else if (arg === "--colors" || arg === "--colours") {
      options.colorCount = readPositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--trials") {
      options.trials = readPositiveInteger(next, "--trials");
      index += 1;
    } else if (arg === "--seed") {
      options.seed = readPositiveInteger(next, "--seed");
      index += 1;
    } else if (arg === "--forbid-boundary-pairs") {
      options.forbidBoundaryPairs = true;
    } else if (arg === "--require-full-rectangle") {
      options.requireFullRectangle = true;
    } else if (arg === "--generator") {
      options.generator = readGeneratorMethod(next);
      index += 1;
    } else if (arg === "--constrained-generator") {
      options.generator = GENERATOR_METHOD.FILLED_CONSTRAINED;
    } else if (arg === "--sparse-generator") {
      options.generator = GENERATOR_METHOD.SPARSE_RANDOM;
    } else if (arg === "--occupancy") {
      options.occupancy = readProbability(next, "--occupancy");
      index += 1;
    } else if (arg === "--copies-per-color" || arg === "--copies-per-colour") {
      options.copiesPerColor = readPositiveInteger(next, arg);
      index += 1;
    } else if (arg === "--rocks") {
      options.rocks = readNonNegativeInteger(next, "--rocks");
      index += 1;
    } else if (arg === "--analyze-single-corner-first") {
      options.analyzeSingleCornerFirst = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.rows * options.cols > 60) {
    throw new Error("This experiment uses BigInt bit masks and is intended for at most 60 cells.");
  }

  return options;
}

function readNonNegativeInteger(value, name) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return number;
}

function readPositiveInteger(value, name) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return number;
}

function readProbability(value, name) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0 || number > 1) {
    throw new Error(`${name} must be a number between 0 and 1.`);
  }

  return number;
}

function readGeneratorMethod(value) {
  if (!Object.values(GENERATOR_METHOD).includes(value)) {
    throw new Error(`--generator must be one of: ${Object.values(GENERATOR_METHOD).join(", ")}.`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage: node experiments/min-move-distribution.js [options]

Options:
  --trials N       random boards to sample; default ${DEFAULT_TRIALS}
  --seed N         deterministic RNG seed; default ${DEFAULT_SEED}
  --rows N         grid rows; default ${DEFAULT_ROWS}
  --cols N         grid columns; default ${DEFAULT_COLS}
  --colors N       colour count; default ${DEFAULT_COLOR_COUNT}
  --forbid-boundary-pairs
                   disallow two-candy moves where both endpoints are on the outer grid boundary
  --require-full-rectangle
                   require the selected rectangle to contain no previously cleared cells
  --generator NAME  generator method: uniform, filled-constrained, sparse-random, balanced-sparse
  --constrained-generator
                   alias for --generator filled-constrained
  --sparse-generator
                   alias for --generator sparse-random
  --occupancy P    sparse generator occupancy probability; default ${DEFAULT_OCCUPANCY}
  --copies-per-color N
                   balanced sparse copies per colour; default 3
  --rocks N        add N non-adjacent interior rocks in empty cells; default 0
  --analyze-single-corner-first
                   for 3-move optima, count boards with an optimal first move clearing one corner cell
  --verbose        print per-board search sizes`);
}

function randomItem(items, rng) {
  return items[Math.floor(rng() * items.length)];
}

function shuffle(items, rng) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function mulberry32(seed) {
  let value = seed >>> 0;

  return function random() {
    value += 0x6D2B79F5;

    let mixed = value;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);

    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}
