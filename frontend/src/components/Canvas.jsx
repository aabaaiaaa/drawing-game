import { useEffect, useRef, useState } from 'react'

function Canvas({ socket, roomCode, isDrawing }) {
  const canvasRef = useRef(null)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    socket.on('drawing', ({ drawData }) => {
      drawLine(drawData)
    })

    return () => {
      socket.off('drawing')
    }
  }, [socket])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [isDrawing])

  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e) => {
    if (!isDrawing) return
    setIsMouseDown(true)
    const { x, y } = getCoordinates(e)

    const drawData = {
      x0: x,
      y0: y,
      x1: x,
      y1: y,
      color,
      brushSize
    }

    drawLine(drawData)
    socket.emit('draw', { roomCode, drawData })
  }

  const draw = (e) => {
    if (!isMouseDown || !isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = getCoordinates(e)

    const drawData = {
      x0: ctx.lastX || x,
      y0: ctx.lastY || y,
      x1: x,
      y1: y,
      color,
      brushSize
    }

    drawLine(drawData)
    socket.emit('draw', { roomCode, drawData })

    ctx.lastX = x
    ctx.lastY = y
  }

  const stopDrawing = () => {
    setIsMouseDown(false)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lastX = null
    ctx.lastY = null
  }

  const drawLine = ({ x0, y0, x1, y1, color, brushSize }) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div>
      {isDrawing && (
        <div className="drawing-tools">
          {colors.map((c) => (
            <button
              key={c}
              className={`color-btn ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              type="button"
            />
          ))}
          <div className="size-control">
            <label>Size: {brushSize}px</label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
            />
          </div>
          <button onClick={clearCanvas} type="button" style={{ width: 'auto', padding: '10px 20px' }}>
            Clear
          </button>
        </div>
      )}

      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
    </div>
  )
}

export default Canvas
