
-- Add request_number to document_requests for formatted IDs (REQ-001)
ALTER TABLE public.document_requests 
ADD COLUMN request_number SERIAL;

CREATE UNIQUE INDEX idx_document_requests_request_number ON public.document_requests(request_number);

-- Function to get formatted request ID
CREATE OR REPLACE FUNCTION public.get_formatted_request_id(req_number integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'REQ-' || LPAD(req_number::text, 3, '0')
$$;

-- Create payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.document_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'gcash', 'paymaya')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  reference_number text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_request_payment UNIQUE (request_id)
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Payments RLS policies
CREATE POLICY "Students can view own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own payments"
ON public.payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
ON public.payments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payments"
ON public.payments FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create feedback table
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  message_type text NOT NULL CHECK (message_type IN ('suggestion', 'complaint', 'inquiry', 'other')),
  message text NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 2000),
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Feedback RLS policies
CREATE POLICY "Students can insert own feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can view own feedback"
ON public.feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback status"
ON public.feedback FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete feedback"
ON public.feedback FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
BEFORE UPDATE ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add validation constraints to existing tables
ALTER TABLE public.document_requests 
ADD CONSTRAINT check_status_values 
CHECK (status IN ('pending', 'ongoing', 'ready_for_pickup', 'complete', 'cancelled'));

ALTER TABLE public.document_requests 
ADD CONSTRAINT check_total_amount_positive 
CHECK (total_amount >= 0);

ALTER TABLE public.document_request_items 
ADD CONSTRAINT check_price_positive 
CHECK (price >= 0);
