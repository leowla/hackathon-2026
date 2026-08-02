import { useEffect, useRef, useState } from 'react'
import { speak } from '../lib/tts'

const WS_URL = 'ws://localhost:3321/ws/device'

export function useSocket() {
  const [question, setQuestion] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [buttonPressCount, setButtonPressCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let cancelled = false
    let ws
    let retryDelay = 1000

    function connect() {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('Connected to answer socket')
        retryDelay = 1000
      }

      ws.onmessage = (event) => {
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          console.error('Bad message:', event.data)
          return
        }

        if (msg.type === 'question') {
          setQuestion(msg.question)
          setIsSpeaking(true);
          speak(msg.question, () => setIsSpeaking(false)).catch((err) => {
            console.error("TTS failed", err)
            setIsSpeaking(false)
          });
        }

        if (msg.type === 'button-press') {
          console.log('Button press:', msg.button)
          setButtonPressCount((n) => n + 1)
        }

        if (msg.type === 'error') {
          console.error('Socket error message:', msg.error)
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
      }

      ws.onclose = () => {
        console.log('Disconnected from answer socket')
        if (!cancelled) {
          setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30000)
        }
      }
    }
    connect()

    return () => {
      cancelled = true
      wsRef.current?.close()
    }
  }, [])

  function sendAnswer(answer: string) {
    if (!question || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'answer-response', question, answer }))
  }

  return { question, sendAnswer, isSpeaking, buttonPressCount }
}
