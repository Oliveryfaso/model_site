import { useAudio } from "./AudioProvider"

export function SoundToggle() {
  const { enabled, toggle } = useAudio()
  const label = enabled ? "关闭声音" : "开启声音"

  return (
    <button
      className="sound-toggle"
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      onClick={() => void toggle()}
    >
      {label}
    </button>
  )
}
