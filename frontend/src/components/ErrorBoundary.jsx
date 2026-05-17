import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('System Crash intercepted:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-2xl border border-[#F3F4F6]">
            <div className="w-20 h-20 bg-red-50 text-[#E24B4A] rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
              <AlertTriangle size={40} />
            </div>
            <h1 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-tight mb-4">Something went wrong</h1>
            <p className="text-[14px] text-[#6B7280] leading-relaxed mb-10">
              The application encountered an unexpected error. This has been logged for administrative review.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="btn-primary w-full flex items-center justify-center gap-3 py-4"
            >
              <RefreshCw size={18} />
              <span className="uppercase">Reload System</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
