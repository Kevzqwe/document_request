-- Fix feedback policies: drop restrictive ones and recreate as permissive
DROP POLICY "Students can insert own feedback" ON public.feedback;
DROP POLICY "Students can view own feedback" ON public.feedback;
DROP POLICY "Admins can view all feedback" ON public.feedback;
DROP POLICY "Admins can update feedback status" ON public.feedback;
DROP POLICY "Admins can delete feedback" ON public.feedback;

CREATE POLICY "Students can insert own feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can view own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update feedback status" ON public.feedback
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete feedback" ON public.feedback
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix announcements policies: drop restrictive ones and recreate as permissive
DROP POLICY "Everyone can view announcements" ON public.announcements;
DROP POLICY "Admins can insert announcements" ON public.announcements;
DROP POLICY "Admins can update announcements" ON public.announcements;
DROP POLICY "Admins can delete announcements" ON public.announcements;

CREATE POLICY "Everyone can view announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert announcements" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete announcements" ON public.announcements
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Also fix other tables with same restrictive issue
DROP POLICY "Students can insert own requests" ON public.document_requests;
DROP POLICY "Students can view own requests" ON public.document_requests;
DROP POLICY "Admins can view all requests" ON public.document_requests;
DROP POLICY "Admins can update all requests" ON public.document_requests;

CREATE POLICY "Students can insert own requests" ON public.document_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can view own requests" ON public.document_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests" ON public.document_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all requests" ON public.document_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix payments
DROP POLICY "Students can insert own payments" ON public.payments;
DROP POLICY "Students can view own payments" ON public.payments;
DROP POLICY "Admins can view all payments" ON public.payments;
DROP POLICY "Admins can update payments" ON public.payments;

CREATE POLICY "Students can insert own payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix document_request_items
DROP POLICY "Students can insert items for own requests" ON public.document_request_items;
DROP POLICY "Users can view items of their requests" ON public.document_request_items;

CREATE POLICY "Students can insert items for own requests" ON public.document_request_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM document_requests
    WHERE document_requests.document_request_id = document_request_items.request_id
    AND document_requests.user_id = auth.uid()
  ));

CREATE POLICY "Users can view items of their requests" ON public.document_request_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM document_requests
    WHERE document_requests.document_request_id = document_request_items.request_id
    AND (document_requests.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));