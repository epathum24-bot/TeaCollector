import { useState, useEffect, useRef } from "react";
import { statusName } from "../api/client.js";
const paths = {
  leaf: "M20 4C10 3 3 7 5 15c6 8 15 0 15-11ZM5 20 15 10",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  truck:
    "M2 5h12v12H2zM14 9h4l4 4v4h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  list: "M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01",
  bill: "M5 3h14v18l-3-2-4 2-4-2-3 2ZM8 8h8M8 12h8M8 16h4",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  exit: "M9 4H4v16h5M13 7l5 5-5 5M8 12h12",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "m5 12 4 4L19 6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
};
export function Icon({ name = "leaf", size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.leaf} />
    </svg>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Icon name="leaf" size={24} />
      </span>
      <span>
        TeaCollector<small>COLLECTION & BILLING</small>
      </span>
    </div>
  );
}
export function Badge({ value }) {
  return <span className={`badge ${value}`}>{statusName(value)}</span>;
}
export function Empty({ title = "Nothing here yet", children }) {
  return (
    <div className="empty">
      <Icon name="leaf" size={32} />
      <h3>{title}</h3>
      <p>{children || "Your records will appear here."}</p>
    </div>
  );
}
export function Field({ label, value, onChange, options, hint, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        >
          {options.map((o) => (
            <option
              key={typeof o === "string" ? o : o.value}
              value={typeof o === "string" ? o : o.value}
            >
              {typeof o === "string" ? o : o.label}
            </option>
          ))}
        </select>
      ) : props.multiline ? (
        <textarea
          {...props}
          multiline={undefined}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...props}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Form({
  initial,
  onSubmit,
  submit = "Save changes",
  children,
  onCancel,
}) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bind = (name) => ({
    value: values[name] ?? "",
    onChange: (value) => setValues((v) => ({ ...v, [name]: value })),
  });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await onSubmit(values);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children(bind, values, setValues)}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Please wait…" : submit}
        </button>
      </div>
    </form>
  );
}
export function Modal({ title, children, close, wide = false, className = "" }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () =>
      [
        ...panel.current.querySelectorAll(
          "button, input, select, textarea, a[href]",
        ),
      ].filter((x) => !x.disabled);
    focusable()[0]?.focus();
    const handle = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = focusable();
        const i = els.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && i === els.length - 1) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  // The modal lifecycle should run once per opened modal, not on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={panel}
      >
        <div className="modal-top">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
