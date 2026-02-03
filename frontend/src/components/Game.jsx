import { useEffect, useRef, useState } from 'react'
import Canvas from './Canvas'

function Game({ socket, roomCode, player, players, gameState, setGameState }) {
  const [guess, setGuess] = useState('')
  const [revealedLetters, setRevealedLetters] = useState([])

  useEffect(() => {
    const timer = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        timeLeft: Math.max(0, prev.timeLeft - 1)
      }))
    }, 1000)

    return () => clearInterval(timer)
  }, [setGameState])

  useEffect(() => {
    socket.on('letterRevealed', ({ revealed }) => {
      setRevealedLetters(revealed)
    })

    return () => {
      socket.off('letterRevealed')
    }
  }, [socket])

  useEffect(() => {
    setRevealedLetters([])
    setGuess('')
  }, [gameState.drawerId])

  const handleGuess = (e) => {
    e.preventDefault()
    if (guess.trim()) {
      socket.emit('guess', { roomCode, word: guess })
      setGuess('')
    }
  }

  const getWordDisplay = () => {
    if (gameState.isDrawing || gameState.currentWord) {
      return gameState.currentWord?.toUpperCase() || ''
    }

    const revealedMap = new Map(revealedLetters.map(({ index, letter }) => [index, letter]))

    let display = ''
    for (let i = 0; i < gameState.wordLength; i++) {
      if (revealedMap.has(i)) {
        display += revealedMap.get(i).toUpperCase()
      } else {
        display += '_'
      }
      display += ' '
    }
    return display
  }

  return (
    <div className="container">
      <h1>Drawing Game</h1>

      <div className="game-info">
        <div className="round-info">
          Round {gameState.currentRound} / {gameState.totalRounds}
        </div>
        <div className="timer">{gameState.timeLeft}s</div>
        <div style={{ marginTop: '10px', fontSize: '1.1em', color: '#666' }}>
          {gameState.isDrawing ? "It's your turn to draw!" : `${gameState.drawerName} is drawing`}
        </div>
      </div>

      <div className="game-container">
        <div className="game-main">
          <div className="word-display">{getWordDisplay()}</div>

          <Canvas
            socket={socket}
            roomCode={roomCode}
            isDrawing={gameState.isDrawing}
          />

          {!gameState.isDrawing && (
            <form onSubmit={handleGuess} className="guess-input-container">
              <input
                type="text"
                placeholder="Type your guess..."
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                maxLength={30}
                autoFocus
              />
              <button type="submit">Guess</button>
            </form>
          )}
        </div>

        <div className="game-sidebar">
          <h2>Players</h2>
          <ul className="players-list">
            {players.map((p) => (
              <li key={p.id} className="player-item">
                <div>
                  <span className="player-name">{p.name}</span>
                  {p.handicap > 0 && (
                    <span className="handicap">+{p.handicap} handicap</span>
                  )}
                </div>
                <span className="player-score">{p.score} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Game
