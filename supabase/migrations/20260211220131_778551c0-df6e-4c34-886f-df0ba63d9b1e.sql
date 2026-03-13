-- Drop old check constraint and recreate with values matching the UI
ALTER TABLE public.document_requests DROP CONSTRAINT check_status_values;

ALTER TABLE public.document_requests ADD CONSTRAINT check_status_values 
  CHECK (status IN ('pending', 'Processing', 'Approved', 'Ready', 'Completed', 'Cancelled'));