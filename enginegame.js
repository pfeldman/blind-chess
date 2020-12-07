const letterPosition = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const numbersPosition = [8, 7, 6, 5, 4, 3, 2, 1]

function engineGame(options) {
  options = options || {}
  var game = new Chess();
  var board;
  var engine = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker(options.stockfishjs || 'stockfish.js');
  var evaler = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker(options.stockfishjs || 'stockfish.js');
  var engineStatus = {};
  var displayScore = false;
  var time = { wtime: 300000, btime: 300000, winc: 2000, binc: 2000 };
  var playerColor = 'white';
  var clockTimeoutID = null;
  var isEngineRunning = false;
  var announced_game_over;
  // do not pick up pieces if the game is over
  // only pick up pieces for White
  var onDragStart = function(source, piece, position, orientation) {
    var re = playerColor == 'white' ? /^b/ : /^w/
    if (game.game_over() ||
      piece.search(re) !== -1) {
      return false;
    }
  };

  setInterval(function ()
  {
    if (announced_game_over) {
      return;
    }

    if (game.game_over()) {
      announced_game_over = true;
      alert("Game Over");
    }
  }, 1000);

  function uciCmd(cmd, which) {
    (which || engine).postMessage(cmd);
  }
  uciCmd('uci');

  function displayStatus() {
    var status = 'Engine: ';
    if(!engineStatus.engineLoaded) {
      status += 'loading...';
    } else if(!engineStatus.engineReady) {
      status += 'loaded...';
    } else {
      status += 'ready.';
    }

    if(engineStatus.search) {
      status += '<br>' + engineStatus.search;
      if(engineStatus.score && displayScore) {
        status += (engineStatus.score.substr(0, 4) === "Mate" ? " " : ' Score: ') + engineStatus.score;
      }
    }
    $('#engineStatus').html(status);
  }

  function displayClock(color, t) {
    var isRunning = false;
    if(time.startTime > 0 && color == time.clockColor) {
      t = Math.max(0, t + time.startTime - Date.now());
      isRunning = true;
    }
    var id = color == playerColor ? '#time2' : '#time1';
    var sec = Math.ceil(t / 1000);
    var min = Math.floor(sec / 60);
    sec -= min * 60;
    var hours = Math.floor(min / 60);
    min -= hours * 60;
    var display = hours + ':' + ('0' + min).slice(-2) + ':' + ('0' + sec).slice(-2);
    if(isRunning) {
      display += sec & 1 ? ' <--' : ' <-';
    }
    $(id).text(display);
  }

  function updateClock() {
    displayClock('white', time.wtime);
    displayClock('black', time.btime);
  }

  function clockTick() {
    updateClock();
    var t = (time.clockColor == 'white' ? time.wtime : time.btime) + time.startTime - Date.now();
    var timeToNextSecond = (t % 1000) + 1;
    clockTimeoutID = setTimeout(clockTick, timeToNextSecond);
  }

  function stopClock() {
    if(clockTimeoutID !== null) {
      clearTimeout(clockTimeoutID);
      clockTimeoutID = null;
    }
    if(time.startTime > 0) {
      var elapsed = Date.now() - time.startTime;
      time.startTime = null;
      if(time.clockColor == 'white') {
        time.wtime = Math.max(0, time.wtime - elapsed);
      } else {
        time.btime = Math.max(0, time.btime - elapsed);
      }
    }
  }

  function startClock() {
    if(game.turn() == 'w') {
      time.wtime += time.winc;
      time.clockColor = 'white';
    } else {
      time.btime += time.binc;
      time.clockColor = 'black';
    }
    time.startTime = Date.now();
    clockTick();
  }

  function get_moves()
  {
    var moves = '';
    var history = game.history({verbose: true});

    for(var i = 0; i < history.length; ++i) {
      var move = history[i];
      moves += ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
    }

    return moves;
  }

  function speak(sentence) {
    const utterance = new SpeechSynthesisUtterance(sentence)
    utterance.lang = 'es-AR'
    utterance.rate = 1
    utterance.pitch = 1

    window.speechSynthesis.speak(utterance)
  }

  function prepareMove() {
    stopClock();
    $('#pgn').text(game.pgn());
    board.position(game.fen());
    updateClock();
    var turn = game.turn() == 'w' ? 'white' : 'black';
    if(turn != playerColor) {
      uciCmd('position startpos moves' + get_moves());
      uciCmd('position startpos moves' + get_moves(), evaler);
      uciCmd("eval", evaler);

      if (time && time.wtime) {
        uciCmd("go " + (time.depth ? "depth " + time.depth : "") + " wtime " + time.wtime + " winc " + time.winc + " btime " + time.btime + " binc " + time.binc);
      } else {
        uciCmd("go " + (time.depth ? "depth " + time.depth : ""));
      }
      isEngineRunning = true;
    }
    const movementList = game.pgn().replace(/[0-9]+\./g, '').split(' ').filter(a => a.length).map(a => a.trim())
    if (((playerColor === 'white' && !(movementList.length % 2)) || (playerColor !== 'white' && movementList.length % 2)) && movementList.length) {
      const characters = {
        N: 'Caballo',
        P: 'Peon',
        B: 'Alfil',
        R: 'Torre',
        Q: 'Dama',
        K: 'Rey'
      }
      const lastMovement = movementList[movementList.length - 1]
      let read = ''
      if (lastMovement === 'O-O-O') {
        read = 'Enroque Largo'
      } else if (lastMovement === 'O-O') {
        read = 'Enroque Corto'
      } else {
        const postitionNotQueen = lastMovement.replace(/=.*/, '')
        const justPosition = postitionNotQueen.replace(/\+|-|!|#|=/g, '')
        const position = justPosition.substr(-2).replace(/b/g, 'be')
        const capture = postitionNotQueen.includes('x')
        const check = postitionNotQueen.includes('+')
        let character = postitionNotQueen.length > 2 ? (characters[postitionNotQueen.substr(0, 1)] || (capture ? postitionNotQueen.substr(0, 1) : '')) : ''
        const removeCapture = justPosition.replace('x', '')
        const extraDetails = removeCapture.substr(1, removeCapture.length - 3)
        const isMate = postitionNotQueen.includes('#')
        const corona = lastMovement.includes('=')
        read = `${character} ${extraDetails ? `,de ${extraDetails},` : ''} ${capture ? 'come en' : ''} ${position} ${corona ? `, y Corona ${characters[lastMovement.split('=')[1].substr(0, 1)]}` : ''} ${check ? ' Jaque' : ''} ${isMate ? `Jaque Mate, ${playerColor === 'white' ? 'negras' : 'blancas'} ganan` : ''}`
        read = read.replace(/\s+/, ' ')
        read = read.replace(/\sb/g, ' be')
      }
      speak(read)
      setTimeout(() => {
        listen();
      }, 1000)
    }
    if(game.history().length >= 2 && !time.depth && !time.nodes) {
      startClock();
    }
  }

  evaler.onmessage = function(event) {
    var line;

    if (event && typeof event === "object") {
      line = event.data;
    } else {
      line = event;
    }

    if (line === "uciok" || line === "readyok" || line.substr(0, 11) === "option name") {
      return;
    }
  }

  engine.onmessage = function(event) {
    var line;

    if (event && typeof event === "object") {
      line = event.data;
    } else {
      line = event;
    }
    if(line == 'uciok') {
      engineStatus.engineLoaded = true;
    } else if(line == 'readyok') {
      engineStatus.engineReady = true;
    } else {
      var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
      /// Did the AI move?
      if(match) {
        isEngineRunning = false;
        game.move({from: match[1], to: match[2], promotion: match[3]});
        prepareMove();
        uciCmd("eval", evaler)
        //uciCmd("eval");
        /// Is it sending feedback?
      } else if(match = line.match(/^info .*\bdepth (\d+) .*\bnps (\d+)/)) {
        engineStatus.search = 'Depth: ' + match[1] + ' Nps: ' + match[2];
      }

      /// Is it sending feed back with a score?
      if(match = line.match(/^info .*\bscore (\w+) (-?\d+)/)) {
        var score = parseInt(match[2]) * (game.turn() == 'w' ? 1 : -1);
        /// Is it measuring in centipawns?
        if(match[1] == 'cp') {
          engineStatus.score = (score / 100.0).toFixed(2);
          /// Did it find a mate?
        } else if(match[1] == 'mate') {
          engineStatus.score = 'Mate in ' + Math.abs(score);
        }

        /// Is the score bounded?
        if(match = line.match(/\b(upper|lower)bound\b/)) {
          engineStatus.score = ((match[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineStatus.score
        }
      }
    }
    displayStatus();
  };

  var onDrop = function(source, target) {
    // see if the move is legal
    var move = game.move({
      from: source,
      to: target,
      promotion: document.getElementById("promote").value
    });

    // illegal move
    if (move === null) {
      speak('Movimiento Ilegal, intente de nuevo')
      setTimeout(() => {
        listen()
      }, 1000)
      return 'snapback';
    }

    prepareMove();
  };

  function parseFen(fen) {
    const boardFen = fen.split(' ')[0]
    const boardFenRows = boardFen.split('/')

    return boardFenRows.map(row => {
      let rowExpanded = []
      for (let charIndex in row){
        let char = row[charIndex]
        if (isNaN(char)){
          rowExpanded.push(char)
          continue
        }
        let i = 0
        let numEmptySpaces = parseInt(char, 10)

        while (i++ < numEmptySpaces){
          rowExpanded.push('')
        }
      }

      return rowExpanded
    })
  }

  const getPositionFromFen = (row, column) => {
    return `${letterPosition[column]}${numbersPosition[row]}`
  }

  const isBlack = (letterPos, numberPos) => letterPos % 2 !== numberPos % 2

  const getNumbersFromPosition = (position) => {
    const positions = position.split('')
    const letter = positions[0]
    const number = positions[1]

    return [letterPosition.findIndex(letterP => letterP === letter), numbersPosition.findIndex(numberP => numberP === parseInt(number))]
  }

  const findInFen = (letter, onlyFirst = true, color, inLetter) => {
    const column = []
    const row = []
    const fenParsed = parseFen(game.fen())
    fenParsed.forEach((r, i) => {
      r.forEach((cell, j) => {
        if (cell === letter) {
          column.push(j)
          row.push(i)
        }
      })
    })

    let positions = column.map((column, index) => getPositionFromFen(row[index], column))

    if (color) {
      positions = positions.map(position => {
        const posArr = getNumbersFromPosition(position)
        if (isBlack(posArr[0], posArr[1]) === (color === 'black')) {
          return position
        }
        return null
      })

      positions = positions.filter(pos => pos)
    }

    if (inLetter) {
      positions = positions.filter(pos => pos.includes(inLetter))
    }

    if (onlyFirst) return positions[0]

    return positions
  }

  const getPossibleHorsePositions = (finalPosition) => {
    const possiblePositions = []
    const listMovements = [
      [-2, -1],
      [-1, -2],
      [-2, 1],
      [-1, 2],
      [1, 2],
      [2, 1],
      [1, -2],
      [2, -1]
    ]

    const [letterPos, numberPos] = getNumbersFromPosition(finalPosition)

    listMovements.forEach(([l, n]) => {
      const finalL = letterPos + l
      const finalN = numberPos + n
      if (finalL > 0 && finalL < 9 && finalN > 0 && finalN < 9) {
        possiblePositions.push(getPositionFromFen(finalN, finalL))
      }
    })

    return possiblePositions
  }

  const ficha = (finalPosition, extra, char) => {
    const getLetter = (letter) => playerColor === 'white' ? letter.toUpperCase() : letter.toLowerCase()
    let source = null
    switch (char) {
      case 'dama': {
        const letter = getLetter('Q')

        source = findInFen(letter, true)
        break
      }
      case 'alfil': {
        const [letterPos, numberPos] = getNumbersFromPosition(finalPosition)
        const letter = getLetter('B')

        const isCBlack = isBlack(letterPos, numberPos)

        source = findInFen(letter, true, isCBlack ? 'black' : 'white')

        break
      }
      case 'caballo': {
        const letter = getLetter('N')
        const horses = findInFen(letter, false, undefined, extra)

        const possiblePositions = getPossibleHorsePositions(finalPosition)


        const finalHorses = horses.filter(horse => possiblePositions.includes(horse))
        if (finalHorses.length > 1) {
          speak('Por favor, indique la columna y, o numero del caballo que quiere mover');
          setTimeout(() => {
            listen()
          }, 1000)
        } else {
          source = finalHorses[0]
        }
        break
      }
      case 'torre': {
        const letter = getLetter('R')
        const torres = findInFen(letter, false, undefined, extra)

        const finalTorres = torres.filter(torre => {
          const parsedFen = parseFen(game.fen())
          let valid = true
          const [RookLetterPos, RookNumberPos] = getNumbersFromPosition(torre)
          const [letterPos, numberPos] = getNumbersFromPosition(finalPosition)

          if (RookNumberPos === numberPos) {
            const start = RookLetterPos > letterPos ? letterPos : RookLetterPos
            const end = RookLetterPos > letterPos ? RookLetterPos : letterPos
            for (let i = start; i <= end; i++) {
              if (i !== RookLetterPos) {
                if (i === letterPos) {
                  if (getLetter(parsedFen[RookNumberPos][i]) === parsedFen[RookNumberPos][i] && parsedFen[RookNumberPos][i]) {
                    valid = false
                  }
                } else {
                  if (parsedFen[RookNumberPos][i]) {
                    valid = false
                  }
                }
              }
            }
          }

          if (RookLetterPos === letterPos) {
            const start = RookNumberPos > numberPos ? numberPos : RookNumberPos
            const end = RookNumberPos > numberPos ? RookNumberPos : numberPos
            for (let i = start; i <= end; i++) {
              if (i !== RookNumberPos) {
                if (i === numberPos) {
                  if (getLetter(parsedFen[i][RookLetterPos]) === parsedFen[i][RookLetterPos] && parsedFen[i][RookLetterPos]) {
                    valid = false
                  }
                } else {
                  if (parsedFen[i][RookLetterPos]) {
                    valid = false
                  }
                }
              }
            }
          }

          return (RookLetterPos === letterPos || RookNumberPos === numberPos) && valid;
        })

        if (finalTorres.length > 1) {
          speak('Por favor, indique la columna y, o numero de la torre que quiere mover');
          setTimeout(() => {
            listen()
          }, 1000)
        } else {
          source = finalTorres[0]
        }

        break
      }
      case 'rey': {
        const letter = getLetter('K')
        source = findInFen(letter)
        break
      }
    }

    if (source) {
      onDrop(source, finalPosition)
    } else {
      speak('No es posible hacer ese movimiento, puede que no haya entendido correctamente, quieres repetirlo?');
    }
  }

  const enroque = (_, _1, _2, isLong, _4) => {
    const number = playerColor === 'white' ? '1' : '8'
    const source = `e${number}`
    const destination = `${isLong ? 'c' : 'g'}${number}`

    onDrop(source, destination)
  }

  const peonCome = (finalPosition, fromPosition, _) => {
    const position = finalPosition.split('');
    let sum = playerColor === 'white' ? -1 : 1

    const number = parseInt(position[1]) + sum
    const source = `${fromPosition}${number}`

    onDrop(source, finalPosition)
  }

  const peon = (finalPosition) => {
    const position = finalPosition.split('');
    const x = letterPosition.findIndex(pos => pos === position[0])
    const y = numbersPosition.findIndex(pos => pos === parseInt(position[1]))

    const fenParsed = parseFen(game.fen())

    const letter = playerColor === 'white' ? 'P' : 'p'
    let sum = playerColor === 'white' ? 1 : -1

    let source;

    if (fenParsed[y + sum][x] === letter) {
      const number = numbersPosition[y + sum]
      const letter = letterPosition[x]
      source = `${letter}${number}`

    } else {
      sum = sum * 2
      if (fenParsed[y + sum] && fenParsed[y + sum][x] === letter) {
        const number = numbersPosition[y + sum]
        const letter = letterPosition[x]
        source = `${letter}${number}`
      }
    }
    onDrop(source, finalPosition);
  }

  const listen = () => {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || webkitSpeechGrammarList

    const recognition = new SpeechRecognition();
    const speechRecognitionList = new SpeechGrammarList();

    const chars = [ 'caballo' , 'rey' , 'dama', 'alfil', 'torre' ];
    const words = [];

    letterPosition.forEach((letter) => {
      numbersPosition.forEach(number => {
        words.push({
          char: 'pawn',
          text: `${letter}${number}`,
          position: `${letter}${number}`,
          callback: peon,
          captures: false,
          extra: null
        })
      })
    })

    chars.forEach(char => {
      letterPosition.forEach((letter) => {
        numbersPosition.forEach(number => {
          words.push({
            char,
            text: `${char} ${letter}${number}`,
            position: `${letter}${number}`,
            callback: ficha,
            captures: false,
            extra: null
          })
        })
      })
    })

    words.push({
      char: 'king',
      text: 'Enroque Corto',
      position: null,
      callback: enroque,
      captures: false,
      extras: false
    })

    words.push({
      char: 'king',
      text: 'Enroque Largo',
      position: null,
      callback: enroque,
      captures: false,
      extras: true
    })

    const finalWords = words.map(word => word.text)
    finalWords.push('a come b')
    finalWords.push('b come a')
    finalWords.push('b come c')
    finalWords.push('c come b')
    finalWords.push('c come d')
    finalWords.push('d come c')
    finalWords.push('d come e')
    finalWords.push('e come d')
    finalWords.push('e come f')
    finalWords.push('f come e')
    finalWords.push('f come g')
    finalWords.push('g come f')
    finalWords.push('g come h')
    finalWords.push('h come g')

    const grammar = '#JSGF V1.0; grammar finalWords; public <finalWords> = ' + finalWords.join(' | ') + ' ;'
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
    recognition.continuous = false
    recognition.lang = 'es-AR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 100;

    chars.forEach(char => {
      letterPosition.forEach((letter) => {
        numbersPosition.forEach(number => {
          if (char === 'caballo' || char === 'torre') {
            letterPosition.forEach((l) => {
              numbersPosition.forEach(n => {
                words.push({
                  char,
                  text: `${char} ${l}${n} ${letter}${number}`,
                  position: `${letter}${number}`,
                  callback: ficha,
                  captures: false,
                  extras: 'a'
                })
              })
            })
            words.push({
              char,
              text: `${char} a ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'a'
            })

            words.push({
              char,
              text: `${char} b ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'b'
            })

            words.push({
              char,
              text: `${char} c ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'c'
            })

            words.push({
              char,
              text: `${char} d ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'd'
            })

            words.push({
              char,
              text: `${char} e ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'e'
            })

            words.push({
              char,
              text: `${char} f ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'f'
            })

            words.push({
              char,
              text: `${char} g ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'g'
            })

            words.push({
              char,
              text: `${char} h ${letter}${number}`,
              position: `${letter}${number}`,
              callback: ficha,
              captures: false,
              extras: 'h'
            })
          }
        })
      })
    })

    letterPosition.forEach((letter) => {
      numbersPosition.forEach(number => {
        words.push({
          char: 'pawn',
          text: `a come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'a'
        })

        words.push({
          char: 'pawn',
          text: `b come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'b'
        })

        words.push({
          char: 'pawn',
          text: `c come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'c'
        })

        words.push({
          char: 'pawn',
          text: `d come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'd'
        })

        words.push({
          char: 'pawn',
          text: `e come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'e'
        })

        words.push({
          char: 'pawn',
          text: `f come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'f'
        })

        words.push({
          char: 'pawn',
          text: `g come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'g'
        })

        words.push({
          char: 'pawn',
          text: `h come ${letter}${number}`,
          position: `${letter}${number}`,
          callback: peonCome,
          captures: true,
          extras: 'h'
        })
      })
    })

    chars.forEach(char => {
      letterPosition.forEach((letter) => {
        numbersPosition.forEach(number => {
          words.push({
            char,
            text: `${char} come ${letter}${number}`,
            position: `${letter}${number}`,
            callback: ficha,
            captures: true,
            extras: null
          });
        })
      })
    })

    document.getElementsByClassName('microphone')[0].addEventListener('click', () => {
      listen()
    })

    recognition.onstart = function() {
      document.getElementsByClassName('microphone')[0].classList.add('listening')
      document.getElementsByClassName('message')[0].classList.remove('visible')
    }

    recognition.onend = function() {
      if (playerColor.substr(0, 1) === game.turn()) {
        document.getElementsByClassName('microphone')[0].classList.remove('listening')
        document.getElementsByClassName('message')[0].classList.add('visible')
      }
    }

    recognition.onresult = function(event) {
      if (event.results.length > 0) {
        let res = null
        Array.from(event.results[0]).forEach(result => {
          words.forEach(word => {
            const basicTransform = result.transcript.replace(/\s/g, '').toLowerCase()
            if (basicTransform === word.text.replace(/\s/g, '').toLowerCase() && !res) {
              res = word
            }
            if (result.transcript
              .replace(/\s/g, '')
              .replace(/de/gi, 'd')
              .replace(/y/gi, 'e')
              .replace(/efe/gi, 'f')
              .replace(/je/gi, 'g')
              .replace(/comen/gi, 'come')
              .replace(/en/gi, '')
              .replace(/se/gi, 'c')
              .replace(/ce/gi, 'c')
              .replace(/cé/gi, 'c')
              .replace(/ze/gi, 'c')
              .replace(/ve/gi, 'b')
              .replace(/be/gi, 'b')
              .replace('alpin', 'alfil')
              .replace('qué', 'g')
              .replace('que', 'g')
              .replace('uno', '1')
              .replace('dos', '2')
              .replace('tres', '3')
              .replace('cuatro', '4')
              .replace('cinco', '5')
              .replace('seis', '6')
              .replace('siete', '7')
              .toLowerCase() === word.text.replace(/\s/g, '').toLowerCase() && !res) {
              res = word
            }
          })
        })

        if (res && res.callback) {
          res.callback(res.position, res.extras, res.char);
        } else {
          speak('No entendí, repita por favor');
          window.setTimeout(() => {
            listen();
          }, 1000)
        }
      }
    }
    recognition.start()
  }

  // update the board position after the piece snap
  // for castling, en passant, pawn promotion
  var onSnapEnd = function() {
    board.position(game.fen());
  };

  var cfg = {
    showErrors: true,
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
  };

  board = new ChessBoard('board', cfg);
  return {
    reset: function() {
      game.reset();
      uciCmd('setoption name Contempt value 0');
      //uciCmd('setoption name Skill Level value 20');
      this.setSkillLevel(0);
      uciCmd('setoption name King Safety value 0'); /// Agressive 100 (it's now symetric)
    },
    loadPgn: function(pgn) { game.load_pgn(pgn); },
    setPlayerColor: function(color) {
      playerColor = color;
      board.orientation(playerColor);
    },
    setSkillLevel: function(skill) {
      var max_err,
        err_prob,
        difficulty_slider;

      if (skill < 0) {
        skill = 0;
      }
      if (skill > 20) {
        skill = 20;
      }

      time.level = skill;

      /// Change thinking depth allowance.
      if (skill < 5) {
        time.depth = "1";
      } else if (skill < 10) {
        time.depth = "2";
      } else if (skill < 15) {
        time.depth = "3";
      } else {
        /// Let the engine decide.
        time.depth = "";
      }

      uciCmd('setoption name Skill Level value ' + skill);

      ///NOTE: Stockfish level 20 does not make errors (intentially), so these numbers have no effect on level 20.
      /// Level 0 starts at 1
      err_prob = Math.round((skill * 6.35) + 1);
      /// Level 0 starts at 10
      max_err = Math.round((skill * -0.5) + 10);

      uciCmd('setoption name Skill Level Maximum Error value ' + max_err);
      uciCmd('setoption name Skill Level Probability value ' + err_prob);
    },
    setTime: function(baseTime, inc) {
      time = { wtime: baseTime * 1000, btime: baseTime * 1000, winc: inc * 1000, binc: inc * 1000 };
    },
    setDepth: function(depth) {
      time = { depth: depth };
    },
    setNodes: function(nodes) {
      time = { nodes: nodes };
    },
    setContempt: function(contempt) {
      uciCmd('setoption name Contempt value ' + contempt);
    },
    setAggressiveness: function(value) {
      uciCmd('setoption name Aggressiveness value ' + value);
    },
    setDisplayScore: function(flag) {
      displayScore = flag;
      displayStatus();
    },
    start: function() {
      uciCmd('ucinewgame');
      uciCmd('isready');
      engineStatus.engineReady = false;
      engineStatus.search = null;
      displayStatus();
      prepareMove();
      announced_game_over = false;
      if (playerColor === 'white') {
        setTimeout(() => {
          listen();
        }, 1500);
      }
    },
    undo: function() {
      if(isEngineRunning)
        return false;
      game.undo();
      game.undo();
      engineStatus.search = null;
      displayStatus();
      prepareMove();
      return true;
    }
  };
}
