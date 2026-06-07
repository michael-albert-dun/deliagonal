# Visual Style Snapshot: Glossy Candy / Bug / Neon Title

Saved on 2026-06-08 before experimenting with the next icon direction.

## Theme Variables Used By The Title And Tabletop

```css
:root {
  --board-bg: #efe7f0;
  --gingham-line: rgba(164, 47, 49, 0.18);
  --neon-fill: #ffe2a8;
  --neon-edge: rgba(93, 52, 85, 0.64);
  --neon-primary: rgba(255, 86, 182, 0.92);
  --neon-primary-soft: rgba(255, 86, 182, 0.72);
  --neon-secondary: rgba(61, 204, 198, 0.48);
  --neon-shadow: #2d2536;
  --selected: #2f2640;
}

.play-area.is-blue-diner {
  --board-bg: #e8eef5;
  --gingham-line: rgba(32, 98, 166, 0.2);
  --neon-fill: #dff7ff;
  --neon-edge: rgba(40, 72, 116, 0.62);
  --neon-primary: rgba(36, 174, 255, 0.9);
  --neon-primary-soft: rgba(36, 174, 255, 0.68);
  --neon-secondary: rgba(255, 112, 187, 0.46);
  --neon-shadow: #243247;
}
```

## Title

```css
h1 {
  margin: 0;
  color: var(--neon-fill);
  font-family: "Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", sans-serif;
  font-size: clamp(2rem, 8vw, 3.25rem);
  font-weight: 900;
  line-height: 0.92;
  letter-spacing: 0;
  text-shadow:
    0 1px 0 var(--neon-edge),
    0 -1px 0 rgba(255, 255, 255, 0.72),
    0 0 2px #fff,
    0 0 7px var(--neon-primary),
    0 0 14px var(--neon-primary-soft),
    0 0 24px var(--neon-secondary),
    0 2px 0 var(--neon-shadow);
}
```

## Candies

```css
.tile:not(.is-empty) {
  background: radial-gradient(ellipse at center 61%, rgba(39, 33, 47, 0.13) 0 18%, transparent 37%);
}

.tile.is-selected {
  background: radial-gradient(ellipse at center 61%, rgba(39, 33, 47, 0.17) 0 19%, transparent 38%);
}

.candy {
  position: relative;
  display: block;
  width: 66%;
  height: auto;
  aspect-ratio: 1;
  border-radius: 999px;
  box-shadow:
    inset 8px 9px 13px rgba(255, 255, 255, 0.5),
    inset -8px -10px 14px rgba(70, 38, 52, 0.24),
    0 3px 5px rgba(50, 37, 56, 0.17),
    0 1px 1px rgba(50, 37, 56, 0.2);
  opacity: 1;
  transform: scale(1);
  transition:
    opacity 320ms ease,
    transform 320ms ease,
    box-shadow 220ms ease;
}

.tile.is-selected .candy {
  box-shadow:
    0 0 0 4px var(--selected),
    inset 8px 9px 13px rgba(255, 255, 255, 0.5),
    inset -8px -10px 14px rgba(70, 38, 52, 0.24),
    0 3px 5px rgba(50, 37, 56, 0.17),
    0 1px 1px rgba(50, 37, 56, 0.2);
}

.candy::after {
  content: "";
  position: absolute;
  width: 26%;
  height: 18%;
  border-radius: 999px;
  top: 20%;
  left: 22%;
  background: rgba(255, 255, 255, 0.56);
  filter: blur(1px);
}

.candy-orange {
  background: radial-gradient(circle at 34% 30%, #ffdca3 0 14%, #e69f00 56%, #ad7600 100%);
}

.candy-blue {
  background: radial-gradient(circle at 34% 30%, #9ed8ff 0 14%, #0072b2 56%, #004f7d 100%);
}

.candy-green {
  background: radial-gradient(circle at 34% 30%, #9ee8cf 0 14%, #009e73 56%, #006f51 100%);
}

.candy-purple {
  background: radial-gradient(circle at 34% 30%, #ffc8e8 0 14%, #cc79a7 56%, #925174 100%);
}

.mini-candy {
  border-radius: 999px;
  background: radial-gradient(circle at 34% 30%, #ffc8e8 0 14%, #cc79a7 56%, #925174 100%);
  box-shadow:
    inset 4px 5px 8px rgba(255, 255, 255, 0.48),
    inset -4px -5px 8px rgba(70, 38, 52, 0.22),
    0 3px 6px rgba(50, 37, 56, 0.16);
}
```

## Bugs

```css
.bug {
  position: relative;
  z-index: 1;
  display: block;
  width: 62%;
  height: auto;
  aspect-ratio: 1;
  border-radius: 52% 52% 46% 46%;
  background:
    radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.82) 0 9%, transparent 18%),
    radial-gradient(ellipse at 63% 30%, rgba(255, 255, 255, 0.32) 0 9%, transparent 24%),
    radial-gradient(ellipse at 38% 13%, rgba(255, 255, 255, 0.38) 0 18%, transparent 44%),
    radial-gradient(circle at 52% 58%, #00b989 0 38%, #009e73 57%, #006747 100%);
  box-shadow:
    inset 8px 9px 12px rgba(255, 255, 255, 0.5),
    inset -7px -10px 14px rgba(12, 43, 36, 0.34),
    inset 0 2px 5px rgba(255, 255, 255, 0.26),
    0 3px 5px rgba(50, 37, 56, 0.16),
    0 1px 1px rgba(50, 37, 56, 0.18);
}

.bug::before {
  content: "";
  position: absolute;
  top: 13%;
  bottom: 13%;
  left: 50%;
  width: 3px;
  border-radius: 999px;
  background: rgba(39, 33, 47, 0.56);
  transform: translateX(-50%);
}

.bug::after {
  content: "";
  position: absolute;
  top: 25%;
  left: 17%;
  width: 66%;
  height: 50%;
  border-top: 2px solid rgba(39, 33, 47, 0.46);
  border-bottom: 2px solid rgba(39, 33, 47, 0.34);
  border-radius: 999px;
}

.tile.is-bug::before,
.tile.is-bug::after {
  content: "";
  position: absolute;
  top: 23%;
  width: 14%;
  height: 18%;
  border-top: 2px solid rgba(39, 33, 47, 0.46);
  pointer-events: none;
  z-index: 2;
}

.tile.is-bug::before {
  left: 31%;
  border-right: 2px solid rgba(39, 33, 47, 0.46);
  border-radius: 0 999px 0 0;
  transform: rotate(-22deg);
}

.tile.is-bug::after {
  right: 31%;
  border-left: 2px solid rgba(39, 33, 47, 0.46);
  border-radius: 999px 0 0 0;
  transform: rotate(22deg);
}

.bug-button .bug-icon {
  border-radius: 52% 52% 46% 46%;
  transform: translateY(2px);
  z-index: 1;
  background:
    radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.82) 0 9%, transparent 18%),
    radial-gradient(ellipse at 63% 30%, rgba(255, 255, 255, 0.32) 0 9%, transparent 24%),
    radial-gradient(ellipse at 38% 13%, rgba(255, 255, 255, 0.38) 0 18%, transparent 44%),
    radial-gradient(circle at 52% 58%, #00b989 0 38%, #009e73 57%, #006747 100%);
  box-shadow:
    inset 4px 5px 8px rgba(255, 255, 255, 0.5),
    inset -4px -5px 8px rgba(12, 43, 36, 0.3),
    inset 0 1px 3px rgba(255, 255, 255, 0.24),
    0 3px 6px rgba(50, 37, 56, 0.16);
}
```
