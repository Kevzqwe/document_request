import { supabase } from '@/integrations/supabase/client';
import { DOCUMENT_TYPES } from '@/lib/documents';

interface SaveRequestParams {
  userId: string;
  studentName: string;
  contactNumber: string;
  gradeLevel: string;
  section: string;
  documents: string[]; // document labels
  paymentMethod: string;
  totalAmount: number;
  referenceNumber?: string | null;
  paymentStatus?: string;
  paidAt?: string | null;
}

export async function saveRequestToDb(params: SaveRequestParams) {
  const {
    userId,
    studentName,
    contactNumber,
    gradeLevel,
    section,
    documents,
    paymentMethod,
    totalAmount,
    referenceNumber = null,
    paymentStatus = 'pending',
    paidAt = null,
  } = params;

  try {
    // 1. Insert document_request
    const { data: request, error: reqError } = await supabase
      .from('document_requests')
      .insert({
        user_id: userId,
        student_name: studentName,
        contact_number: contactNumber,
        grade_level: gradeLevel,
        section: section,
        payment_method: paymentMethod,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (reqError) {
      console.error('Error inserting document_request:', reqError);
      return null;
    }

    // 2. Insert document_request_items
    const items = documents.map((docLabel) => {
      const doc = DOCUMENT_TYPES.find((d) => d.label === docLabel);
      return {
        request_id: request.id,
        document_type: docLabel,
        price: doc?.price || 0,
      };
    });

    const { error: itemsError } = await supabase
      .from('document_request_items')
      .insert(items);

    if (itemsError) {
      console.error('Error inserting document_request_items:', itemsError);
    }

    // 3. Insert payment record
    const { error: payError } = await supabase
      .from('payments')
      .insert({
        request_id: request.id,
        user_id: userId,
        amount: totalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        reference_number: referenceNumber,
        paid_at: paidAt,
      });

    if (payError) {
      console.error('Error inserting payment:', payError);
    }

    return request;
  } catch (err) {
    console.error('saveRequestToDb error:', err);
    return null;
  }
}
