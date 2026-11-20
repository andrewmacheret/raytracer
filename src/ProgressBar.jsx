// progress goes from 0 to 1
export default function ProgressBar({ text, progress }) {
  const percent = Math.round(progress * 100);
  return (
    <div className="progress-bar-wrapper">
      <div className="progress-bar-text">{text}</div>
      <div className="progress-bar" role="progressbar" aria-label={text} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div style={{ width: percent + '%' }}></div>
      </div>
    </div>
  );
}
