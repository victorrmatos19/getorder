'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const LS_MUDO = 'cozinha_som_mudo'

type AudioCtor = typeof AudioContext

// Alerta sonoro da cozinha: som sintetizado (Web Audio), mudo persistido e
// Wake Lock. O áudio só fica disponível após um gesto do usuário (autoplay).
export function useCozinhaAlerta() {
  const [armado, setArmado] = useState(false)
  const [mudo, setMudo] = useState(false)

  // refs para o callback do realtime ler estado atual sem re-subscrever
  const ctxRef = useRef<AudioContext | null>(null)
  const armadoRef = useRef(false)
  const mudoRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // carrega preferência de mudo
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_MUDO) === '1') {
        setMudo(true)
        mudoRef.current = true
      }
    } catch {
      /* localStorage indisponível — ignora */
    }
  }, [])

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
      if (!Ctor) return null
      ctxRef.current = new Ctor()
    }
    return ctxRef.current
  }, [])

  const pedirWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } }
      if (nav.wakeLock && (wakeLockRef.current == null || wakeLockRef.current.released)) {
        wakeLockRef.current = await nav.wakeLock.request('screen')
      }
    } catch {
      /* sem suporte / negado — degrada sem quebrar */
    }
  }, [])

  // re-adquire o Wake Lock quando a aba volta a ficar visível (o lock cai ao esconder)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && armadoRef.current) void pedirWakeLock()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      try {
        void wakeLockRef.current?.release()
      } catch {
        /* ignora */
      }
      wakeLockRef.current = null
    }
  }, [pedirWakeLock])

  // libera o áudio (gesto do usuário) + Wake Lock
  const armar = useCallback(async () => {
    const ctx = getCtx()
    if (ctx) {
      try {
        await ctx.resume()
        // tick quase mudo p/ desbloquear o autoplay (especialmente iOS)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.value = 0.0001
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.03)
      } catch {
        /* ignora */
      }
    }
    armadoRef.current = true
    setArmado(true)
    void pedirWakeLock()
  }, [getCtx, pedirWakeLock])

  const alternarMudo = useCallback(() => {
    setMudo((m) => {
      const novo = !m
      mudoRef.current = novo
      try {
        localStorage.setItem(LS_MUDO, novo ? '1' : '0')
      } catch {
        /* ignora */
      }
      return novo
    })
  }, [])

  // toca um chime de 2 notas (só se armado e não-mudo)
  const tocar = useCallback(() => {
    if (!armadoRef.current || mudoRef.current) return
    const ctx = getCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    const notas = [880, 1174.66] // Lá5 → Ré6
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const inicio = now + i * 0.16
      const dur = 0.15
      gain.gain.setValueAtTime(0.0001, inicio)
      gain.gain.exponentialRampToValueAtTime(0.32, inicio + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(inicio)
      osc.stop(inicio + dur + 0.02)
    })
  }, [getCtx])

  return { armado, mudo, armar, alternarMudo, tocar }
}
