import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

/**
 * Converts a symbol operator into an evaluation operator.
 * - × -> *
 * - ÷ -> /
 */
function normalizeOperator(op) {
  if (op === '×') return '*';
  if (op === '÷') return '/';
  return op;
}

/**
 * Returns true if the character is one of the supported operators.
 */
function isOperator(ch) {
  return ch === '+' || ch === '-' || ch === '×' || ch === '÷';
}

/**
 * Formats a number-like string for display (no scientific notation, trims trailing zeros).
 */
function formatNumberString(valueStr) {
  if (valueStr === '' || valueStr === '-' || valueStr === 'Error') return valueStr;

  const n = Number(valueStr);
  if (!Number.isFinite(n)) return 'Error';

  // Keep up to 12 significant digits to avoid crazy long floats on display.
  const compact = n.toPrecision(12);
  const asNumber = Number(compact);

  // Convert to string and trim trailing zeros after decimal.
  let s = String(asNumber);
  if (s.includes('e') || s.includes('E')) {
    // If scientific notation slipped in, fall back to a fixed representation.
    s = asNumber.toFixed(10);
  }

  if (s.includes('.')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s;
}

/**
 * Evaluates an expression of the form: a (op) b
 */
function computeBinary(aStr, op, bStr) {
  const a = Number(aStr);
  const b = Number(bStr);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Error';

  let result;
  switch (normalizeOperator(op)) {
    case '+':
      result = a + b;
      break;
    case '-':
      result = a - b;
      break;
    case '*':
      result = a * b;
      break;
    case '/':
      if (b === 0) return 'Error';
      result = a / b;
      break;
    default:
      return 'Error';
  }

  if (!Number.isFinite(result)) return 'Error';
  return formatNumberString(String(result));
}

/**
 * A small reducer-like state machine for calculator interactions.
 */
function nextState(prev, action) {
  const { display, acc, pendingOp, justEvaluated } = prev;

  const set = (patch) => ({ ...prev, ...patch });

  switch (action.type) {
    case 'CLEAR':
      return {
        display: '0',
        acc: null,
        pendingOp: null,
        justEvaluated: false,
      };

    case 'BACKSPACE': {
      if (justEvaluated) {
        // After evaluation, backspace acts like clear to avoid confusing states.
        return {
          display: '0',
          acc: null,
          pendingOp: null,
          justEvaluated: false,
        };
      }
      if (display === 'Error') return set({ display: '0' });
      if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) return set({ display: '0' });
      return set({ display: display.slice(0, -1) });
    }

    case 'DIGIT': {
      const d = action.digit;
      if (display === 'Error') return set({ display: d, justEvaluated: false });

      if (justEvaluated) {
        // Start a new number after "=".
        return set({ display: d, acc: null, pendingOp: null, justEvaluated: false });
      }

      if (display === '0') return set({ display: d });
      if (display === '-0') return set({ display: '-' + d });
      return set({ display: display + d });
    }

    case 'DOT': {
      if (display === 'Error') return set({ display: '0.', justEvaluated: false });

      if (justEvaluated) {
        return set({ display: '0.', acc: null, pendingOp: null, justEvaluated: false });
      }

      if (display.includes('.')) return prev;
      return set({ display: display + '.' });
    }

    case 'TOGGLE_SIGN': {
      if (display === 'Error') return set({ display: '0' });
      if (display === '0') return prev;
      if (display.startsWith('-')) return set({ display: display.slice(1) });
      return set({ display: '-' + display });
    }

    case 'PERCENT': {
      if (display === 'Error') return set({ display: '0' });
      const n = Number(display);
      if (!Number.isFinite(n)) return set({ display: 'Error' });
      const res = formatNumberString(String(n / 100));
      return set({ display: res, justEvaluated: false });
    }

    case 'OP': {
      const op = action.op;

      if (display === 'Error') {
        // If error, ignore operator.
        return prev;
      }

      // If we just evaluated and hit an operator, keep display as accumulator.
      if (acc === null) {
        return set({
          acc: display,
          pendingOp: op,
          justEvaluated: false,
        });
      }

      // If there is already an accumulator and pending op, and user presses operator:
      // - if user hasn't typed a new number since last op, just update pending operator
      // - else compute with current display.
      if (pendingOp) {
        if (justEvaluated) {
          return set({ pendingOp: op, justEvaluated: false });
        }
        // Compute using acc (first operand) and display (second operand).
        const computed = computeBinary(acc, pendingOp, display);
        if (computed === 'Error') {
          return set({ display: 'Error', acc: null, pendingOp: null, justEvaluated: false });
        }
        return set({ acc: computed, display: computed, pendingOp: op, justEvaluated: false });
      }

      return set({ pendingOp: op, justEvaluated: false });
    }

    case 'EQUALS': {
      if (display === 'Error') return prev;

      if (acc !== null && pendingOp) {
        const computed = computeBinary(acc, pendingOp, display);
        if (computed === 'Error') {
          return set({ display: 'Error', acc: null, pendingOp: null, justEvaluated: false });
        }
        return set({ display: computed, acc: null, pendingOp: null, justEvaluated: true });
      }
      return set({ justEvaluated: true });
    }

    default:
      return prev;
  }
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');

  const [calc, setCalc] = useState(() => ({
    display: '0',
    acc: null,
    pendingOp: null,
    justEvaluated: false,
  }));

  const displayRef = useRef(null);

  // Apply theme to document element.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const displayValue = useMemo(() => {
    if (calc.display === 'Error') return 'Error';
    // Format for display; keep "0." etc intact.
    if (calc.display.endsWith('.')) return calc.display;
    return formatNumberString(calc.display);
  }, [calc.display]);

  // Keep the display scrolled to the end (for long numbers).
  useEffect(() => {
    if (!displayRef.current) return;
    displayRef.current.scrollLeft = displayRef.current.scrollWidth;
  }, [displayValue]);

  // Keyboard support.
  useEffect(() => {
    const onKeyDown = (e) => {
      const { key } = e;

      // Prevent the page from scrolling on space.
      if (key === ' ') e.preventDefault();

      if (key >= '0' && key <= '9') {
        setCalc((s) => nextState(s, { type: 'DIGIT', digit: key }));
        return;
      }

      if (key === '.') {
        setCalc((s) => nextState(s, { type: 'DOT' }));
        return;
      }

      if (key === 'Enter' || key === '=') {
        e.preventDefault();
        setCalc((s) => nextState(s, { type: 'EQUALS' }));
        return;
      }

      if (key === 'Backspace') {
        setCalc((s) => nextState(s, { type: 'BACKSPACE' }));
        return;
      }

      if (key === 'Escape') {
        setCalc((s) => nextState(s, { type: 'CLEAR' }));
        return;
      }

      if (key === '%') {
        setCalc((s) => nextState(s, { type: 'PERCENT' }));
        return;
      }

      // Operators
      if (key === '+' || key === '-') {
        setCalc((s) => nextState(s, { type: 'OP', op: key }));
        return;
      }
      if (key === '*' || key === 'x' || key === 'X') {
        setCalc((s) => nextState(s, { type: 'OP', op: '×' }));
        return;
      }
      if (key === '/') {
        setCalc((s) => nextState(s, { type: 'OP', op: '÷' }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const press = (action) => setCalc((s) => nextState(s, action));

  return (
    <div className="App">
      <header className="App-header">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          type="button"
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>

        <main className="calc-shell" aria-label="Calculator">
          <div className="calc-top">
            <div className="calc-title">
              <span className="calc-badge">Calculator</span>
              <span className="calc-hint" aria-hidden="true">
                Keyboard enabled
              </span>
            </div>

            <div className="calc-display" role="status" aria-live="polite" aria-label="Calculator display">
              <div className="calc-display-inner" ref={displayRef}>
                {displayValue}
              </div>
            </div>
          </div>

          <div className="calc-grid" role="group" aria-label="Calculator buttons">
            <button className="calc-btn calc-btn-fn" type="button" onClick={() => press({ type: 'CLEAR' })}>
              AC
            </button>
            <button className="calc-btn calc-btn-fn" type="button" onClick={() => press({ type: 'BACKSPACE' })}>
              ⌫
            </button>
            <button className="calc-btn calc-btn-fn" type="button" onClick={() => press({ type: 'PERCENT' })}>
              %
            </button>
            <button className="calc-btn calc-btn-op" type="button" onClick={() => press({ type: 'OP', op: '÷' })}>
              ÷
            </button>

            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '7' })}>
              7
            </button>
            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '8' })}>
              8
            </button>
            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '9' })}>
              9
            </button>
            <button className="calc-btn calc-btn-op" type="button" onClick={() => press({ type: 'OP', op: '×' })}>
              ×
            </button>

            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '4' })}>
              4
            </button>
            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '5' })}>
              5
            </button>
            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '6' })}>
              6
            </button>
            <button className="calc-btn calc-btn-op" type="button" onClick={() => press({ type: 'OP', op: '-' })}>
              −
            </button>

            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '1' })}>
              1
            </button>
            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '2' })}>
              2
            </button>
            <button className="calc-btn" type="button" onClick={() => press({ type: 'DIGIT', digit: '3' })}>
              3
            </button>
            <button className="calc-btn calc-btn-op" type="button" onClick={() => press({ type: 'OP', op: '+' })}>
              +
            </button>

            <button className="calc-btn calc-btn-wide" type="button" onClick={() => press({ type: 'DIGIT', digit: '0' })}>
              0
            </button>
            <button className="calc-btn" type="button" onClick={() => press({ type: 'DOT' })}>
              .
            </button>
            <button className="calc-btn calc-btn-eq" type="button" onClick={() => press({ type: 'EQUALS' })}>
              =
            </button>
          </div>

          <div className="calc-footer">
            <button className="calc-link" type="button" onClick={() => press({ type: 'TOGGLE_SIGN' })}>
              +/−
            </button>
            <span className="calc-help" aria-label="Keyboard help">
              Digits, + − * /, Enter, Backspace, Esc
            </span>
          </div>
        </main>
      </header>
    </div>
  );
}

export default App;
