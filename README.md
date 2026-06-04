# CandyClear

Clear candies from (parts of) a rectangular grid.

- Select (at most two) tiles by clicking. 
- If they are the same colour, they and the rectangle they bound are removed.
- Try to clear the whole field in as few moves as possible.
- Current test mode: balanced sparse 6x6 boards, defaulting to four candies of each colour, filtered to remove one- and two-move solutions.


## Future ideas

- Include a few "rocks". You can't clear a rock (or a region containing it)
- Experiment with different candy shapes as well as colours.
- Explore puzzle generation by number of solutions and optimal move counts.
- Include coins as well as candies. Coins can't be selected but each selection must include at least one coin.


## Variations to serve

- Puzzle mode: present a filled board with no two-move solution, and challenge the player to find a three-move (or target-length) solution.


## Experiments

Estimate the distribution of exact minimum move counts for random full grids:

```sh
node experiments/min-move-distribution.js --trials 1000 --seed 12345 --generator uniform
```

Baseline sample for the current 6x6, four-colour rules: 44.6% clear in 1 move, 46.9% in 2 moves, and 8.5% in 3 moves.

First variation, disallowing two-candy moves where both endpoints lie on the outer boundary:

```sh
node experiments/min-move-distribution.js --trials 20 --seed 7 --forbid-boundary-pairs
```

Exploratory exact sample: 45% clear in 4 moves, 50% in 5 moves, and 5% in 6 moves.

Second variation, requiring each move to clear a full rectangle with no previously vacant cells:

```sh
node experiments/min-move-distribution.js --trials 1000 --seed 12345 --require-full-rectangle
```

For the baseline sample this produced the same minimum move distribution as the original rule.

Constrained filled-board generator experiment: distinct corners, constrained edge interiors including cross-side split cases, and explicit rejection of 1- or 2-move boards.

```sh
node experiments/min-move-distribution.js --rows 4 --cols 4 --trials 1000 --seed 12345 --generator filled-constrained
```

Temporary 4x4 baseline sample: 98.1% clear in 3 moves and 1.9% in 4 moves.

In that 4x4 sample, 870 of the 981 three-move boards had an optimal solution that starts by clearing a single corner.

Sparse 6x6 exploration: occupy each cell with probability 2/3, assign random colours, and reject boards with one- or two-move solutions.

```sh
node experiments/min-move-distribution.js --rows 6 --cols 6 --trials 100 --seed 12345 --generator sparse-random --occupancy 0.6666666667
```

Small sample: 91% clear in 3 moves and 9% in 4 moves.

Balanced sparse 6x6 exploration: place exactly twelve candies, three of each colour, in random cells without replacement, then reject boards with one- or two-move solutions.

```sh
node experiments/min-move-distribution.js --rows 6 --cols 6 --trials 1000 --seed 12345 --generator balanced-sparse --copies-per-color 3
```

Sample: 65.7% clear in 3 moves, 31.6% in 4 moves, 2.6% in 5 moves, and 0.1% in 6 moves.
