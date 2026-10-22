/**
 * Short vibration for a wrong move.
 *
 * Android browsers support navigator.vibrate. iOS Safari doesn't, but since
 * iOS 18 toggling an <input type="checkbox" switch> plays the system haptic
 * tick, so we click a hidden one. iPads have no vibration motor: nothing happens.
 */

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function buzz(): void {
  if (!enabled) return;
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate([45, 70, 45]);
    return;
  }
  tick();
  setTimeout(tick, 110);
}

function tick(): void {
  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // No haptics available.
  }
}
