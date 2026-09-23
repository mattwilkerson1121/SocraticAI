-- Allow Office spreadsheet/presentation uploads for document analysis
alter table public.documents
drop constraint IF exists documents_file_type_check;

alter table public.documents
add constraint documents_file_type_check check (
  file_type in (
    'pdf',
    'docx',
    'txt',
    'md',
    'json',
    'pptx',
    'xlsx'
  )
);