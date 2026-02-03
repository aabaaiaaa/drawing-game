import { useState, useEffect } from 'react'

function Lobby({ roomCode, player, players, totalRounds, timePerRound, onUpdateSettings, onStartGame }) {
  const [rounds, setRounds] = useState(totalRounds)
  const [time, setTime] = useState(timePerRound)

  useEffect(() => {
    setRounds(totalRounds)
    setTime(timePerRound)
  }, [totalRounds, timePerRound])

  const handleRoundsChange = (newRounds) => {
    setRounds(newRounds)
    onUpdateSettings(newRounds, time)
  }

  const handleTimeChange = (newTime) => {
    setTime(newTime)
    onUpdateSettings(rounds, newTime)
  }

  return (
    <div className="container">
      <h1>Game Lobby</h1>

      <div className="room-code">{roomCode}</div>

      <div className="lobby">
        <h2>Players ({players.length})</h2>
        <ul className="players-list">
          {players.map((p) => (
            <li key={p.id} className="player-item">
              <div>
                <span className="player-name">{p.name}</span>
                {p.isHost && <span className="host-badge">HOST</span>}
              </div>
            </li>
          ))}
        </ul>

        {player?.isHost && (
          <>
            <h3 style={{ marginTop: '20px', marginBottom: '15px' }}>Game Settings</h3>

            <label htmlFor="lobby-rounds" style={{ display: 'block', marginBottom: '10px', color: '#666' }}>
              Number of Rounds: {rounds}
            </label>
            <input
              id="lobby-rounds"
              type="range"
              min="1"
              max="10"
              value={rounds}
              onChange={(e) => handleRoundsChange(parseInt(e.target.value))}
              style={{ width: '100%', marginBottom: '20px' }}
            />

            <label htmlFor="lobby-time" style={{ display: 'block', marginBottom: '10px', color: '#666' }}>
              Time per Round: {time} seconds
            </label>
            <input
              id="lobby-time"
              type="range"
              min="15"
              max="180"
              step="15"
              value={time}
              onChange={(e) => handleTimeChange(parseInt(e.target.value))}
              style={{ width: '100%', marginBottom: '20px' }}
            />

            {players.length < 2 && (
              <p style={{ color: '#e74c3c', textAlign: 'center', marginBottom: '15px' }}>
                Need at least 2 players to start
              </p>
            )}
            <button onClick={onStartGame} disabled={players.length < 2}>
              Start Game
            </button>
          </>
        )}

        {!player?.isHost && (
          <>
            <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontWeight: 'bold' }}>Game Settings:</p>
              <p style={{ margin: '5px 0', color: '#666' }}>Rounds: {totalRounds}</p>
              <p style={{ margin: '5px 0', color: '#666' }}>Time per Round: {timePerRound} seconds</p>
            </div>
            <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
              Waiting for host to start the game...
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default Lobby
