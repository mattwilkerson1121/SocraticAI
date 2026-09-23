-- Allow Office spreadsheet/presentation uploads for document analysis
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_file_type_check
  CHECK (file_type IN ('pdf', 'docx', 'txt', 'md', 'json', 'pptx', 'xlsx'));
