import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom'
import io from 'socket.io-client'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'
import EndGame from './components/EndGame'

const socket = io('http://localhost:3001')

function GameContent() {
  const navigate = useNavigate()
  const { roomCode: urlRoomCode } = useParams()
  const location = useLocation()

  const [screen, setScreen] = useState('home')
  const [roomCode, setRoomCode] = useState('')
  const [player, setPlayer] = useState(null)
  const [players, setPlayers] = useState([])
  const [pendingJoin, setPendingJoin] = useState(null)
  const [gameState, setGameState] = useState({
    gameStarted: false,
    currentRound: 0,
    totalRounds: 3,
    timePerRound: 60,
    drawerId: null,
    drawerName: '',
    wordLength: 0,
    timeLeft: 60,
    isDrawing: false,
    currentWord: null
  })
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    socket.on('roomCreated', ({ roomCode, player, totalRounds, timePerRound }) => {
      setRoomCode(roomCode)
      setPlayer(player)
      setPlayers([player])
      setGameState(prev => ({
        ...prev,
        totalRounds,
        timePerRound,
        timeLeft: timePerRound
      }))
      setScreen('lobby')
      navigate(`/room/${roomCode}`)
    })

    socket.on('roomJoined', ({ roomCode, player, players, gameStarted, currentRound, totalRounds, timePerRound, currentTurn }) => {
      setRoomCode(roomCode)
      setPlayer(player)
      setPlayers(players)

      setGameState(prev => {
        const newState = {
          ...prev,
          gameStarted,
          currentRound,
          totalRounds,
          timePerRound,
          timeLeft: timePerRound
        }

        if (currentTurn) {
          newState.drawerId = currentTurn.drawerId
          newState.drawerName = currentTurn.drawerName
          newState.wordLength = currentTurn.wordLength
          newState.timeLeft = currentTurn.timeLeft
          newState.isDrawing = currentTurn.drawerId === socket.id
        }

        return newState
      })

      setScreen(gameStarted ? 'game' : 'lobby')
      if (location.pathname !== `/room/${roomCode}`) {
        navigate(`/room/${roomCode}`)
      }
    })

    socket.on('playerJoined', ({ player, players }) => {
      setPlayers(players)
      showNotification(`${player.name} joined the game!`)
    })

    socket.on('playerLeft', ({ playerName, players }) => {
      setPlayers(players)
      showNotification(`${playerName} left the game`)
    })

    socket.on('newTurn', ({ drawerId, drawerName, wordLength, round, totalRounds, timeLimit }) => {
      const isDrawer = drawerId === socket.id
      setGameState(prev => ({
        ...prev,
        gameStarted: true,
        currentRound: round,
        totalRounds,
        drawerId,
        drawerName,
        wordLength,
        timeLeft: timeLimit,
        isDrawing: isDrawer,
        ...(isDrawer ? {} : { currentWord: null })
      }))
      setScreen('game')
    })

    socket.on('yourTurn', ({ word, round, totalRounds }) => {
      setGameState(prev => ({
        ...prev,
        currentWord: word,
        isDrawing: true,
        currentRound: round,
        totalRounds
      }))
    })

    socket.on('correctGuess', ({ playerName, word, points, playerId }) => {
      showNotification(`${playerName} guessed correctly! +${points} points`)
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, score: p.score + points } : p
      ))
      setGameState(prev => ({
        ...prev,
        currentWord: word
      }))
    })

    socket.on('turnEnded', ({ word }) => {
      showNotification(`Time's up! The word was: ${word}`)
      setGameState(prev => ({
        ...prev,
        currentWord: word
      }))
    })

    socket.on('gameEnded', ({ players }) => {
      setPlayers(players)
      setScreen('endgame')
    })

    socket.on('returnToLobby', ({ players, totalRounds, timePerRound }) => {
      setPlayers(players)
      setGameState(prev => ({
        ...prev,
        gameStarted: false,
        currentRound: 0,
        totalRounds,
        timePerRound,
        drawerId: null,
        drawerName: '',
        wordLength: 0,
        timeLeft: timePerRound,
        isDrawing: false,
        currentWord: null
      }))
      setScreen('lobby')
      showNotification('Starting new game!')
    })

    socket.on('settingsUpdated', ({ totalRounds, timePerRound }) => {
      setGameState(prev => ({
        ...prev,
        totalRounds,
        timePerRound,
        timeLeft: timePerRound
      }))
    })

    socket.on('error', ({ message }) => {
      alert(message)
    })

    return () => {
      socket.off('roomCreated')
      socket.off('roomJoined')
      socket.off('playerJoined')
      socket.off('playerLeft')
      socket.off('newTurn')
      socket.off('yourTurn')
      socket.off('correctGuess')
      socket.off('turnEnded')
      socket.off('gameEnded')
      socket.off('returnToLobby')
      socket.off('settingsUpdated')
      socket.off('error')
    }
  }, [navigate, location.pathname])

  useEffect(() => {
    if (urlRoomCode && !roomCode && !player && screen === 'home') {
      setPendingJoin(urlRoomCode.toUpperCase())
    }
  }, [urlRoomCode, roomCode, player, screen])

  const showNotification = (message) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }

  const createRoom = (playerName, rounds, timePerRound) => {
    socket.emit('createRoom', { playerName, rounds, timePerRound })
  }

  const joinRoom = (roomCode, playerName) => {
    socket.emit('joinRoom', { roomCode, playerName })
  }

  const updateSettings = (totalRounds, timePerRound) => {
    socket.emit('updateSettings', { roomCode, totalRounds, timePerRound })
  }

  const startGame = () => {
    socket.emit('startGame', { roomCode })
  }

  const newGame = () => {
    socket.emit('newGame', { roomCode })
  }

  return (
    <>
      {notification && (
        <div className="notification">{notification}</div>
      )}

      {screen === 'home' && (
        <Home
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          pendingRoomCode={pendingJoin}
        />
      )}

      {screen === 'lobby' && (
        <Lobby
          roomCode={roomCode}
          player={player}
          players={players}
          totalRounds={gameState.totalRounds}
          timePerRound={gameState.timePerRound}
          onUpdateSettings={updateSettings}
          onStartGame={startGame}
        />
      )}

      {screen === 'game' && (
        <Game
          socket={socket}
          roomCode={roomCode}
          player={player}
          players={players}
          gameState={gameState}
          setGameState={setGameState}
        />
      )}

      {screen === 'endgame' && (
        <EndGame players={players} player={player} onNewGame={newGame} />
      )}
    </>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<GameContent />} />
      <Route path="/room/:roomCode" element={<GameContent />} />
    </Routes>
  )
}

export default App
