var board = [];
var rows = 8;
var columns = 8;
var values = [];
var overlay;
var moves = []; // List of moves for undo purposes


// var colours = ["white", "red", "green", "blue", "orange", "purple"];
var colours = ["black", "#eb4d4b", "#6ab04c", "#e056fd", "#30336b", "#22a6b3"];


var movesCount = 0;
var emptyTiles = 0;
var clickedList = [];

var gameOver = false;

window.onload = function () {
  startGame();
  overlay = document.getElementById('overlay')
  console.log(overlay);
}


function startGame() {
  movesCount = 0;
  clickedList = [];
  values = [];
  emptyTiles = 0;
  gameOver = false;
  board = [];
  document.getElementById("moves-count").innerText = movesCount;
  document.getElementById("board").innerHTML = "";
  document.getElementById("game-over").innerText = "";
  // generate values
  for (let r = 0; r < rows; r++) {
    let vrow = [];
    for (let c = 0; c < columns; c++) {
      vrow.push(Math.floor(0.9 + Math.random() * 5.1));
    }
    values.push(vrow);
  }

  // Eliminate diagonal matches
  while (values[0][0] == values[rows - 1][columns - 1] && values[0][0] != 0) {
    values[rows - 1][columns - 1] = 1 + Math.floor(Math.random() * 5);
  }

  while (values[0][columns - 1] == values[rows - 1][0] && values[0][columns - 1] != 0) {
    values[rows - 1][0] = 1 + Math.floor(Math.random() * 5);
  }

  //populate our board
  for (let r = 0; r < rows; r++) {
    let row = [];
    for (let c = 0; c < columns; c++) {
      if (values[r][c] == 0) {
        emptyTiles += 1;
      }
      let tile = makeTile(r, c, values[r][c]);
      document.getElementById("board").append(tile);
      row.push(tile);
    }
    board.push(row);
  }

  // add event listeners
  let information = document.getElementById("info");
  information.addEventListener("click", () => {
    openModal(document.getElementById("info-modal"));
  });

  let undoButton = document.getElementById("undo");
  undoButton.addEventListener("click", () => {
    undo();
  });

  let infoClose = document.getElementById("info-modal-close");
  infoClose.addEventListener("click", () => {
    closeModal(document.getElementById("info-modal"));
  });

  document.addEventListener("keyup", (e) => {
    console.log(e, clickedList);
    if (e.code == "Enter" && clickedList.length > 0) {
      update();
    }
    if (e.code == "Space" && gameOver) {
      startGame();
    }
    if (e.code == "KeyI") {
      openModal(document.getElementById("info-modal"));
    }
    if (e.code == "KeyZ") {
      console.log("Undo");
      undo();
    }
    if (e.code == "Backspace") {
      console.log("Unselect last tile")
      unselectLastTile();
    }
  });

}



function makeTile(r, c, value) {
  let tile = document.createElement("div");
  tile.id = r.toString() + "-" + c.toString() + "-" + value.toString();
  tile.style.backgroundColor = colours[value];
  if (value > 0) {
    tile.innerHTML = value.toString();
    tile.addEventListener("click", clickTile);
  }
  return tile;
}

function update() {
  if (gameOver || clickedList.length == 0) {
    return;
  }

  let tile1 = clickedList[0];
  let tile2 = tile1;
  if (clickedList.length > 1) {
    tile2 = clickedList[1];
  }

  if (tile1.style.backgroundColor != tile2.style.backgroundColor || isBlocked(tile1, tile2)) {
    return;
  }

  tile1.classList.remove("tile-clicked");
  tile1.style.border = "2px solid whitesmoke";
  tile2.classList.remove("tile-clicked");
  tile2.style.border = "2px solid whitesmoke";

  clearBetween(tile1, tile2);
  clickedList = [];
  movesCount += 1;
  document.getElementById("moves-count").innerText = movesCount;

}

function isBlocked(tile1, tile2) {
  let coords = tile1.id.split("-");
  let r1 = parseInt(coords[0]);
  let c1 = parseInt(coords[1]);
  coords = tile2.id.split("-");
  let r2 = parseInt(coords[0]);
  let c2 = parseInt(coords[1]);
  let rt = Math.min(r1, r2);
  let rb = Math.max(r1, r2);
  let cl = Math.min(c1, c2);
  let cr = Math.max(c1, c2);
  for (let r = rt; r <= rb; r++) {
    for (let c = cl; c <= cr; c++) {
      let tile = board[r][c];
      if (value(tile) == 0) {
        console.log("blocked by", tile);
        return true;
      }
    }
  }
  return false;
}

function value(tile) {
  return parseInt(tile.id.split("-")[2]);
}

function row(tile) {
  return parseInt(tile.id.split("-")[0]);
}

function column(tile) {
  return parseInt(tile.id.split("-")[1]);
}

function clearBetween(tile1, tile2) {
  let coords = tile1.id.split("-");
  let r1 = parseInt(coords[0]);
  let c1 = parseInt(coords[1]);
  coords = tile2.id.split("-");
  let r2 = parseInt(coords[0]);
  let c2 = parseInt(coords[1]);
  let rt = Math.min(r1, r2);
  let rb = Math.max(r1, r2);
  let cl = Math.min(c1, c2);
  let cr = Math.max(c1, c2);
  moves.push([rt, rb, cl, cr]);
  for (let r = rt; r <= rb; r++) {
    for (let c = cl; c <= cr; c++) {
      let tile = board[r][c];
      if (!tile.classList.contains("empty")) {
        tile.style.backgroundColor = "white";
        tile.classList = "empty";
        tile.innerHTML = "";
        emptyTiles += 1;
      }
    }
  }
  console.log("Made move", tile1, tile2);
  console.log("Moves", moves);
  gameOver = (emptyTiles == rows * columns);
  if (gameOver) {
    console.log("Game Over");
    document.getElementById("game-over").innerText = "Game Over! (space to restart)";
  }
}

function fillBetween(rt, rb, cl, cr) {
  for (let r = rt; r <= rb; r++) {
    for (let c = cl; c <= cr; c++) {
      let tile = board[r][c];
      if (tile.classList.contains("empty")) {
        tile.style.backgroundColor = colours[values[r][c]];
        tile.classList = "";
        tile.innerHTML = values[r][c];
        emptyTiles -= 1;
      }
    }
  }
  movesCount -= 1;
  document.getElementById("moves-count").innerText = movesCount;
}

function undo() {
  console.log("undo", moves, moves.length);
  if (moves.length == 0) {
    return;
  }
  let move = moves.pop();
  console.log(move);
  console.log(moves);
  fillBetween(move[0], move[1], move[2], move[3]);
}

function clickTile() {
  if (gameOver || this.classList.contains("empty")) {
    return;
  }

  if (this.classList.contains("tile-clicked")) {
    console.log("unclick", this);
    var index = clickedList.indexOf(this);
    clickedList.splice(index, 1);
    this.classList.remove("tile-clicked");
    this.style.border = "2px solid whitesmoke";
  } else if (clickedList.length < 2) {
    console.log("click", this);
    this.classList.add("tile-clicked");
    this.style.border = "2px solid black";
    clickedList.push(this);
    console.log(clickedList);
  }
}

function unselectLastTile() {
  if (clickedList.length > 0) {
    let tile = clickedList.pop();
    tile.classList.remove("tile-clicked");
    tile.style.border = "2px solid whitesmoke";
  }
}

function openModal(modal) {
  if (modal == null) return
  modal.classList.add('active')
  overlay.classList.add('active')
}

function closeModal(modal) {
  if (modal == null) return
  modal.classList.remove('active')
  overlay.classList.remove('active')
}
