import { useState, useEffect } from 'react'

function Home({ onCreateRoom, onJoinRoom, pendingRoomCode }) {
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [rounds, setRounds] = useState(3)
  const [timePerRound, setTimePerRound] = useState(60)
  const [mode, setMode] = useState(null)

  useEffect(() => {
    if (pendingRoomCode) {
      setRoomCode(pendingRoomCode)
      setMode('join')
    }
  }, [pendingRoomCode])

  const handleCreateRoom = (e) => {
    e.preventDefault()
    if (playerName.trim()) {
      onCreateRoom(playerName, rounds, timePerRound)
    }
  }

  const handleJoinRoom = (e) => {
    e.preventDefault()
    if (playerName.trim() && roomCode.trim()) {
      onJoinRoom(roomCode.toUpperCase(), playerName)
    }
  }

  if (!mode) {
    return (
      <div className="container">
        <h1>Drawing Game</h1>
        <button onClick={() => setMode('create')}>Create Room</button>
        <button onClick={() => setMode('join')}>Join Room</button>
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <div className="container">
        <h1>Create Room</h1>
        <form onSubmit={handleCreateRoom}>
          <input
            type="text"
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            required
          />
          <label htmlFor="rounds" style={{ display: 'block', marginBottom: '10px', color: '#666' }}>
            Number of Rounds: {rounds}
          </label>
          <input
            id="rounds"
            type="range"
            min="1"
            max="10"
            value={rounds}
            onChange={(e) => setRounds(parseInt(e.target.value))}
            style={{ marginBottom: '20px' }}
          />
          <label htmlFor="timePerRound" style={{ display: 'block', marginBottom: '10px', color: '#666' }}>
            Time per Round: {timePerRound} seconds
          </label>
          <input
            id="timePerRound"
            type="range"
            min="15"
            max="180"
            step="15"
            value={timePerRound}
            onChange={(e) => setTimePerRound(parseInt(e.target.value))}
            style={{ marginBottom: '20px' }}
          />
          <button type="submit">Create Room</button>
          <button type="button" onClick={() => setMode(null)}>Back</button>
        </form>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Join Room</h1>
      <form onSubmit={handleJoinRoom}>
        <input
          type="text"
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
          required
        />
        <input
          type="text"
          placeholder="Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
          required
        />
        <button type="submit">Join Room</button>
        <button type="button" onClick={() => setMode(null)}>Back</button>
      </form>
    </div>
  )
}

export default Home
