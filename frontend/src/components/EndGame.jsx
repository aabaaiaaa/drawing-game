function EndGame({ players, player, onNewGame }) {
  return (
    <div className="container">
      <h1>Game Over!</h1>

      <div className="scoreboard">
        <h2>Final Scoreboard</h2>
        <table className="scoreboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
              <th>Handicap</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, index) => (
              <tr key={p.id} className={index === 0 ? 'winner' : ''}>
                <td>{index + 1}</td>
                <td>{p.name}</td>
                <td>{p.score}</td>
                <td>{p.handicap > 0 ? `+${p.handicap}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {players.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '1.5em', color: '#667eea' }}>
          {players[0].name} wins!
        </div>
      )}

      {player?.isHost ? (
        <button onClick={onNewGame} style={{ marginTop: '30px' }}>
          Start New Game
        </button>
      ) : (
        <p style={{ textAlign: 'center', marginTop: '30px', color: '#666' }}>
          Waiting for host to start a new game...
        </p>
      )}
    </div>
  )
}

export default EndGame
