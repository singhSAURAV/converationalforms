interface ProgressBarProps {
  current: number
  total: number
  visible: boolean
}

export default function ProgressBar({ current, total, visible }: ProgressBarProps) {
  if (!visible || total === 0) return null

  return (
    <div className="px-4 py-2 text-xs text-[#888] border-b border-[#E8E7E5] bg-[#FAFAF9]">
      Question {Math.min(current + 1, total)} of {total}
    </div>
  )
}
