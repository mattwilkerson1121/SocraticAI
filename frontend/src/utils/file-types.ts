export type ApprovedFileType = 'docx' | 'pdf' | 'xlsx' | 'txt' | 'pptx' | 'md';

export type FileTypeOption = {
  id: ApprovedFileType;
  label: string;
  description: string;
  accept: string;
  extensions: string[];
};

export const APPROVED_FILE_TYPES: FileTypeOption[] = [
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Portable document (.pdf)',
    accept: '.pdf,application/pdf',
    extensions: ['.pdf'],
  },
  {
    id: 'docx',
    label: 'Word',
    description: 'Word document (.docx)',
    accept:
      '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['.docx'],
  },
  {
    id: 'xlsx',
    label: 'Excel',
    description: 'Spreadsheet (.xlsx)',
    accept:
      '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['.xlsx'],
  },
  {
    id: 'pptx',
    label: 'PowerPoint',
    description: 'Presentation (.pptx)',
    accept:
      '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['.pptx'],
  },
  {
    id: 'txt',
    label: 'Text',
    description: 'Plain text (.txt)',
    accept: '.txt,text/plain',
    extensions: ['.txt'],
  },
  {
    id: 'md',
    label: 'Markdown',
    description: 'Markdown (.md)',
    accept: '.md,.markdown,text/markdown,text/plain',
    extensions: ['.md', '.markdown'],
  },
];

export const FILE_ANALYSIS_MODALITIES = [
  'bias_blueprint',
  'socratic_auditor',
  'source_scrutiny',
] as const;

export type FileAnalysisModality = (typeof FILE_ANALYSIS_MODALITIES)[number];
