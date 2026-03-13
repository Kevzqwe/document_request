
-- Fix security: Set search_path on get_formatted_request_id function
CREATE OR REPLACE FUNCTION public.get_formatted_request_id(req_number integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'REQ-' || LPAD(req_number::text, 3, '0')
$$;
