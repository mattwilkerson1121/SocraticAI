import { useEffect, useRef, useState } from 'react';
import { APPROVED_FILE_TYPES, FileTypeOption } from '../utils/file-types';

type ComposerAttachButtonProps = {
  disabled?: boolean;
  isUploading?: boolean;
  onPickType: (option: FileTypeOption) => void;
};

function FileTypeIcon({ id }: { id: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-[10px] font-bold uppercase tracking-wide text-neutral-200">
      {id}
    </span>
  );
}

/**
 * ChatGPT-style + button that opens an approved file-type popover.
 */
export function ComposerAttachButton({
  disabled,
  isUploading,
  onPickType,
}: ComposerAttachButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled || isUploading}
        title="Add files and more"
        aria-label="Add files and more"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={`group relative mb-0.5 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-600 text-neutral-200 transition hover:bg-neutral-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'bg-neutral-700 text-white' : 'bg-transparent'
        }`}
      >
        {isUploading ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
        <span className="pointer-events-none absolute -top-9 left-0 z-20 hidden whitespace-nowrap rounded-full bg-neutral-950 px-3 py-1.5 text-xs text-white shadow-lg group-hover:block">
          Add files and more
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-[300px] overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl"
        >
          <div className="border-b border-neutral-800 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Upload a file
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">Choose a type, then pick from your computer</p>
          </div>
          <ul className="max-h-80 overflow-y-auto p-1.5">
            {APPROVED_FILE_TYPES.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onPickType(option);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-neutral-800"
                >
                  <FileTypeIcon id={option.id} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">{option.label}</span>
                    <span className="block truncate text-xs text-neutral-400">{option.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
