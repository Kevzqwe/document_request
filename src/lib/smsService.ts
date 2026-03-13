import { supabase } from "@/integrations/supabase/client";

interface SendSmsParams {
  phoneNumber: string;
  message: string;
}

interface SmsResponse {
  success: boolean;
  error?: string;
  data?: any;
}

export const smsService = {
  /**
   * Send SMS notification
   */
  send: async ({ phoneNumber, message }: SendSmsParams): Promise<SmsResponse> => {
    try {
      // Use the actual phone number provided
      console.log("Sending SMS to:", phoneNumber);
      
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { phoneNumber, message },
      });

      if (error) {
        console.error("SMS send error:", error);
        return { success: false, error: error.message };
      }

      console.log("SMS sent successfully:", data);
      return { success: true, data };
    } catch (error: any) {
      console.error("SMS service error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send notification when a new request is created
   */
  notifyNewRequest: async (
    phoneNumber: string,
    studentName: string,
    requestId: string,
    documents: string[]
  ): Promise<SmsResponse> => {
    const message = `Hi ${studentName}, your document request (${requestId}) for ${documents.join(", ")} has been submitted successfully. We will notify you once it's ready. - Pateros Catholic School`;
    return smsService.send({ phoneNumber, message });
  },

  /**
   * Send notification when request status changes
   */
  notifyStatusChange: async (
    phoneNumber: string,
    studentName: string,
    requestId: string,
    status: string
  ): Promise<SmsResponse> => {
    let message = "";

    switch (status) {
      case "Processing":
        message = `Hi ${studentName}, your document request (${requestId}) is now being processed. Please wait for further updates. - Pateros Catholic School`;
        break;
      case "Approved":
        message = `Hi ${studentName}, your document request (${requestId}) has been approved. Please wait for it to be ready for pickup. - Pateros Catholic School`;
        break;
      case "Ready":
        message = `Hi ${studentName}, your document request (${requestId}) is now READY FOR PICKUP. Please visit the registrar's office to claim your documents. - Pateros Catholic School`;
        break;
      case "Completed":
        message = `Hi ${studentName}, your document request (${requestId}) has been completed. Thank you for using our services! - Pateros Catholic School`;
        break;
      default:
        message = `Hi ${studentName}, your document request (${requestId}) status has been updated to: ${status}. - Pateros Catholic School`;
    }

    return smsService.send({ phoneNumber, message });
  },
};
