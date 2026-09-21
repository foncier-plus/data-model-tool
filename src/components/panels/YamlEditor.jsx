import { useRef } from 'react'

const EDITOR_CLASS =
  'font-mono text-[11px] leading-5 whitespace-pre p-3'

function findComment(line) {
  let single = false
  let double = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === "'" && !double) single = !single
    else if (char === '"' && !single) double = !double
    else if (char === '#' && !single && !double) {
      if (index === 0 || line[index - 1] === ' ' || line[index - 1] === '\t') return index
    }
  }
  return -1
}

function Line({ line }) {
  const commentIndex = findComment(line)
  const code = commentIndex === -1 ? line : line.slice(0, commentIndex)
  const comment = commentIndex === -1 ? '' : line.slice(commentIndex)
  const match = code.match(/^(\s*)(-\s+)?([A-Za-z0-9_.$-]+)(:)(.*)$/)

  return (
    <div>
      {match ? (
        <>
          <span className="text-zinc-600">{match[1]}</span>
          <span className="text-zinc-600">{match[2] ?? ''}</span>
          <span className="text-sky-400">{match[3]}</span>
          <span className="text-zinc-600">{match[4]}</span>
          <span className="text-emerald-300">{match[5]}</span>
        </>
      ) : (
        <span className="text-zinc-300">{code}</span>
      )}
      {comment ? <span className="text-zinc-500 italic">{comment}</span> : null}
      {'\n'}
    </div>
  )
}

export function YamlEditor({ value, onChange }) {
  const preRef = useRef(null)

  const handleScroll = (event) => {
    const { scrollTop, scrollLeft } = event.currentTarget
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop
      preRef.current.scrollLeft = scrollLeft
    }
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <pre
        ref={preRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${EDITOR_CLASS}`}
      >
        {value.split('\n').map((line, index) => (
          <Line key={index} line={line} />
        ))}
      </pre>
      <textarea
        value={value}
        spellCheck={false}
        wrap="off"
        onChange={(event) => onChange(event.target.value)}
        onScroll={handleScroll}
        className={`absolute inset-0 resize-none overflow-auto bg-transparent text-transparent caret-zinc-100 outline-none ${EDITOR_CLASS}`}
      />
    </div>
  )
}
