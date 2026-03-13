-- Fix payment_method constraint to include 'online'
ALTER TABLE public.payments DROP CONSTRAINT payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check 
  CHECK (payment_method IN ('cash', 'gcash', 'paymaya', 'online'));

-- Fix payment_status constraint to include 'paid'
ALTER TABLE public.payments DROP CONSTRAINT payments_payment_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_status_check 
  CHECK (payment_status IN ('pending', 'processing', 'completed', 'paid', 'failed', 'refunded'));