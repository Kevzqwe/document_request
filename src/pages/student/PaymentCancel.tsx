import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft } from 'lucide-react';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your payment was cancelled. No charges were made to your account.
          </p>
          <p className="text-sm text-muted-foreground">
            You can try again or choose a different payment method.
          </p>

          <div className="pt-4 space-y-2">
            <Button 
              onClick={() => navigate('/student/document-request')} 
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Document Request
            </Button>
            <Button 
              onClick={() => navigate('/student/dashboard')} 
              variant="outline"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancel;