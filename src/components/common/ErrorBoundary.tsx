import React from 'react';
import { translations } from '../../i18n/translations';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function pickLang(): 'zh' | 'en' {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ielts_lang') : null;
  if (stored === 'zh' || stored === 'en') return stored;
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const t = translations[pickLang()].errorBoundary;
      return (
        <div style={{ color: 'red', padding: 24 }}>
          <h2>{t.heading}</h2>
          <pre>{this.state.error?.message}</pre>
          <p>{t.hint}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
