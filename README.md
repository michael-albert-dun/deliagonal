# Deliagonal

Deliagonal is a diner-themed rectangle-clearing puzzle. Pick matching foods on a
6x6 table, clear the diagonal rectangle between them, and try to finish without
wasting moves.

The red deli sign reads "Deli Agonal". Starting a fresh session from the guest
check sends you to the blue deli, "Diagona Deli", and back again on the next
fresh session.

## How To Play

- Select one or two matching foods. Matching endpoints clear the whole rectangle
  between them; selecting the same food twice clears only that food.
- Bugs block rectangles and cannot be selected or cleared.
- The large number below the table is the fewest moves needed from the current
  position.
- A green number means the table is still on an optimal route from its original
  layout. A red number means at least one extra move has been introduced.
- The back button restores the previous table state, and can put the number back
  to green if the restored state is on an optimal route.

Each generated table currently uses four randomly chosen foods from the diner
menu: fried egg, milkshake, waffle, bacon, and burger. The number of foods per
kind and the number of bugs can be changed from the lower-right controls.

## Session Check

The guest check records session progress:

- Tables set: tables where at least one move has been made.
- Tables cleared: tables cleared during the session.
- Perfect clears: cleared tables that never left an optimal route.
- Moves: efficient moves plus inefficient moves.
- Efficiency: efficient moves divided by all charged moves, shown as an
  unevaluated fraction and a whole-number percentage.

A move is efficient if it reduces the minimum number of moves remaining from the
current table. Undoing an efficient move removes credit for that move. Inefficient
moves remain charged even if they are undone.

"Reseat Me" closes the check and keeps the current session. "Try another deli"
starts a fresh session and swaps between the red and blue deli themes.

## Table Generation

Current play mode uses balanced sparse 6x6 tables. It places the active foods in
equal counts, optionally adds non-adjacent bugs, and rejects generated tables that
are too short or too long under the exact minimum-move solver.

If table generation takes too long or cannot find a suitable table, the table is
left empty with a message so the interface does not appear frozen. Trying again,
or reducing the number of foods and/or bugs, usually resolves this.

## Development Notes

The code still uses some older internal names such as `candy`, `color`, and
`copiesPerColor`. These refer to the current food icons and foods-per-kind
setting.

The previous CandyClear visual treatment is preserved in
`docs/visual-style-snapshot-2026-06-08.md` in case the glossy candy/neon version
is needed again.

## Experiments

The experiment scripts predate the Deliagonal theme, so their output and option
names still refer to CandyClear, candies, colours, and rocks. They are still
useful for estimating exact minimum move-count distributions for rule and
generator variants.

Estimate the distribution of exact minimum move counts for random full grids:

```sh
node experiments/min-move-distribution.js --trials 1000 --seed 12345 --generator uniform
```

Baseline sample for the original 6x6, four-colour rules: 44.6% clear in 1 move,
46.9% in 2 moves, and 8.5% in 3 moves.

First variation, disallowing two-candy moves where both endpoints lie on the
outer boundary:

```sh
node experiments/min-move-distribution.js --trials 20 --seed 7 --forbid-boundary-pairs
```

Exploratory exact sample: 45% clear in 4 moves, 50% in 5 moves, and 5% in 6 moves.

Second variation, requiring each move to clear a full rectangle with no
previously vacant cells:

```sh
node experiments/min-move-distribution.js --trials 1000 --seed 12345 --require-full-rectangle
```

For the baseline sample this produced the same minimum move distribution as the
original rule.

Constrained filled-board generator experiment: distinct corners, constrained edge
interiors including cross-side split cases, and explicit rejection of 1- or
2-move boards.

```sh
node experiments/min-move-distribution.js --rows 4 --cols 4 --trials 1000 --seed 12345 --generator filled-constrained
```

Temporary 4x4 baseline sample: 98.1% clear in 3 moves and 1.9% in 4 moves.

In that 4x4 sample, 870 of the 981 three-move boards had an optimal solution
that starts by clearing a single corner.

Sparse 6x6 exploration: occupy each cell with probability 2/3, assign random
colours, and reject boards with one- or two-move solutions.

```sh
node experiments/min-move-distribution.js --rows 6 --cols 6 --trials 100 --seed 12345 --generator sparse-random --occupancy 0.6666666667
```

Small sample: 91% clear in 3 moves and 9% in 4 moves.

Balanced sparse 6x6 exploration: place exactly twelve candies, three of each
colour, in random cells without replacement, then reject boards with one- or
two-move solutions.

```sh
node experiments/min-move-distribution.js --rows 6 --cols 6 --trials 1000 --seed 12345 --generator balanced-sparse --copies-per-color 3
```

Sample: 65.7% clear in 3 moves, 31.6% in 4 moves, 2.6% in 5 moves, and 0.1% in
6 moves.

Rock variation: start from the balanced sparse 6x6 generator with three candies
of each colour, add four rocks in empty interior cells, require rocks to be
non-adjacent even diagonally, and reject moves whose selected rectangle contains
a rock.

```sh
node experiments/min-move-distribution.js --rows 6 --cols 6 --trials 1000 --seed 12345 --generator balanced-sparse --copies-per-color 3 --rocks 4
```

Sample: 0.2% clear in 3 moves, 0.7% in 4, 5.1% in 5, 11.1% in 6, 24.3% in 7,
25.1% in 8, 19.4% in 9, 9.7% in 10, 3.7% in 11, and 0.7% in 12.
