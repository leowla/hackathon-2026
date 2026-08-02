import { useEffect, useRef, useState } from 'react'
import { speak } from '../lib/tts'

const WS_URL = 'ws://localhost:3321/ws/device'

export function useSocket() {
  const [question, setQuestion] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [startListeningSignal, setStartListeningSignal] = useState(0)
  const [stopListeningSignal, setStopListeningSignal] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let cancelled = false
    let ws
    let retryDelay = 1000

    function connect() {
      console.log('[socket] connecting to', WS_URL)
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) {
          console.log('[socket] open fired after cancel, closing')
          ws.close()
          return
        }
        console.log('[socket] connected')
        retryDelay = 1000
      }

      ws.onmessage = (event) => {
        console.log('[socket] raw message:', event.data)
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          console.error('[socket] bad message (not JSON):', event.data)
          return
        }

        console.log('[socket] parsed message:', msg)

        if (msg.type === 'question') {
          setQuestion(msg.question)
          setIsSpeaking(true);
          speak(msg.question, () => setIsSpeaking(false)).catch((err) => {
            console.error("TTS failed", err)
            setIsSpeaking(false)
          });
        }

        if (msg.type === 'start-listening') {
          console.log('[socket] start listening')
          setStartListeningSignal((n) => n + 1)
        }

        if (msg.type === 'stop-listening') {
          console.log('[socket] stop listening')
          setStopListeningSignal((n) => n + 1)
        }

        if (msg.type === 'error') {
          console.error('[socket] server sent error:', msg.error)
        }

        if (msg.type === 'result') {
          console.log('[socket] result:', msg)
        }

        if (!['question', 'start-listening', 'stop-listening', 'error', 'result'].includes(msg.type)) {
          console.warn('[socket] unhandled message type:', msg.type, msg)
        }
      }

      ws.onerror = (err) => {
        console.error('[socket] error:', err)
      }

      ws.onclose = (event) => {
        console.log('[socket] disconnected', { code: event.code, reason: event.reason, wasClean: event.wasClean })
        if (!cancelled) {
          console.log('[socket] reconnecting in', retryDelay, 'ms')
          setTimeout(connect, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30000)
        }
      }
    }
    connect()

    return () => {
      cancelled = true
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [])

  function sendAnswer(answer: string) {
    if (!question || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[socket] sendAnswer skipped', { question, readyState: wsRef.current?.readyState })
      return
    }
    const payload = { type: 'answer-response', question, answer }
    console.log('[socket] sending answer:', payload)
    wsRef.current.send(JSON.stringify(payload))
  }

  return { question, sendAnswer, isSpeaking, startListeningSignal, stopListeningSignal }
}
