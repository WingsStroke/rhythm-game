import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  onExit?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught editor error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-screen bg-[#070710] flex items-center justify-center p-6 select-none text-white">
          <div className="max-w-md w-full bg-[#0d0d1a] border border-red-500/40 rounded-xl p-6 shadow-[0_0_30px_rgba(255,0,85,0.2)] flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-base font-bold text-white mb-2 tracking-wide font-mono">
              An interface error occurred
            </h2>

            <p className="text-xs text-white/60 mb-4 leading-relaxed font-mono">
              An incompatible value was detected during editing. The application recovered its state to preserve your progress.
            </p>

            {this.state.error?.message && (
              <div className="w-full p-2.5 bg-black/60 border border-white/10 rounded text-[11px] font-mono text-red-300/90 mb-5 break-words text-left max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2 px-3 bg-[#00e5ff]/20 hover:bg-[#00e5ff]/30 text-[#00e5ff] rounded-lg border border-[#00e5ff]/50 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>

              {this.props.onExit && (
                <button
                  onClick={this.props.onExit}
                  className="py-2 px-3 bg-white/10 hover:bg-white/15 text-white/80 rounded-lg border border-white/10 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" /> Exit
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
