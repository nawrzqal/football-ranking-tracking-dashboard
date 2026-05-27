export default function ProgressBar({ frame, total, onSeek }) {
  const pct = total <= 1 ? 0 : (frame / (total - 1)) * 100;

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const next = Math.round(ratio * (total - 1));
    onSeek?.(next);
  };

  const numberStyle = {
    fontFamily: "'Bebas Neue', 'STV', sans-serif",
    color: '#017d5b',
    fontSize: '18px',
    letterSpacing: '0.5px',
  };

  return (
    <div className="w-full flex items-center gap-3 select-none">
      <span className="w-10 text-center" style={numberStyle}>
        {Math.floor(frame) + 1}
      </span>
      <div
        className="flex-1 h-2 rounded-full cursor-pointer relative"
        style={{ background: '#cfe6dd' }}
        onClick={handleClick}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: '#066b4f' }}
        />
      </div>
      <span className="w-10 text-center" style={numberStyle}>{total}</span>
    </div>
  );
}
