import { useEffect, useRef } from 'react'
import { Duck } from '../duck/Duck'
import { HELLO, play } from '../duck/player'
import { Aquarium } from '../scenes/Aquarium'
import { Submarine } from '../scenes/Submarine'
import './presentation.css'

/** 1920×1080 outro card for the demo video (recorded to MP4). Live aquarium + sub crossing + repo link. */
export default function Outro() {
  const duck = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const t = setTimeout(() => duck.current && play(duck.current, HELLO), 1200)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="o-root">
      <div className="o-water"><Aquarium bottle /></div>
      <div className="o-sub"><Submarine><Duck ref={duck} /></Submarine></div>
      <div className="o-card">
        <div className="o-link">github.com/albertoZurini/<b>meta-ai-hackathon-2026</b></div>
        <div className="o-foot">100% built during the Meta Global AI Developer Hackathon</div>
        <div className="o-models">
          <span className="p-tag meta">Muse Spark</span><span className="p-tag meta">Muse Image</span>
          <span className="p-tag meta">Muse Voice Transcribe</span><span className="p-tag meta">SAM 3.1</span>
        </div>
      </div>
    </div>
  )
}
