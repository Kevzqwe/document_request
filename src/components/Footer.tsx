import { FileText } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Document Request System
            </span>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-right">
            © {new Date().getFullYear()} All rights reserved. Contact the Registrar's Office for assistance.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
