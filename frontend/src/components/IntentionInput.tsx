type Props = {
  value: string
  onChange: (value: string) => void
}

export function IntentionInput({ value, onChange }: Props) {
  return (
    <div className="intention">
      <label className="intention__label" htmlFor="intention">
        Input your intention
      </label>
      <textarea
        className="intention__input"
        id="intention"
        rows={2}
        placeholder="e.g. I want to stay off football content"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
