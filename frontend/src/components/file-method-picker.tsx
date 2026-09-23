import { SocraticModality } from '../types/index';
import { FILE_ANALYSIS_MODALITIES } from '../utils/file-types';

const FILE_MODALITY_OPTIONS: {
  value: (typeof FILE_ANALYSIS_MODALITIES)[number];
  label: string;
  description: string;
}[] = [
  {
    value: 'bias_blueprint',
    label: 'Bias Blueprint',
    description: 'Find hidden assumptions and biases in the document',
  },
  {
    value: 'socratic_auditor',
    label: 'Socratic Auditor',
    description: 'Ask probing questions about the document',
  },
  {
    value: 'source_scrutiny',
    label: 'Source Scrutiny',
    description: 'Evaluate evidence quality in the document',
  },
];

type FileMethodPickerProps = {
  filename: string;
  onSelect: (modality: SocraticModality) => void;
  onCancel: () => void;
};

/**
 * After a file upload, require choosing a file-compatible Socratic method.
 * Devil's Advocate is intentionally excluded (prompt-only mode).
 */
export function FileMethodPicker({ filename, onSelect, onCancel }: FileMethodPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-method-title"
        className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl"
      >
        <h2 id="file-method-title" className="text-lg font-semibold text-white">
          Choose how to analyze this file
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          <span className="font-medium text-neutral-200">{filename}</span> is ready. Pick a Socratic
          method to continue. Devil&apos;s Advocate is only available for typed prompts.
        </p>

        <div className="mt-4 space-y-2">
          {FILE_MODALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className="flex w-full flex-col rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-left transition hover:border-primary-500 hover:bg-neutral-800"
            >
              <span className="text-sm font-semibold text-white">{option.label}</span>
              <span className="mt-0.5 text-xs text-neutral-400">{option.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
