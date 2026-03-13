
-- Enable realtime for document_requests so students/admins get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_requests;
