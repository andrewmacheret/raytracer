// progress goes from 0 to 1
export function createProgressBar(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'progress-bar-wrapper';

  const label = document.createElement('div');
  label.className = 'progress-bar-text';
  label.textContent = text;

  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', text);
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');

  const fill = document.createElement('div');
  bar.append(fill);
  wrapper.append(label, bar);

  function setProgress(progress) {
    const percent = Math.round(progress * 100);
    bar.setAttribute('aria-valuenow', String(percent));
    fill.style.width = percent + '%';
  }
  setProgress(0);

  return { element: wrapper, setProgress };
}
