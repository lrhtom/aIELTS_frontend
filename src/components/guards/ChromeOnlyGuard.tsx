import { type ReactNode, useState } from 'react';
import '../../styles/ChromeOnlyGuard.css';

export default function ChromeOnlyGuard({ children }: { children: ReactNode }) {
    // 兼容 iOS Chrome (CriOS) 和桌面端/安卓端 Chrome
    // 同时排除 Edge (Edg) 和 Opera (OPR)
    const isChrome = (/Chrome/.test(navigator.userAgent) || /CriOS/.test(navigator.userAgent)) && 
                     !/Edg\/|OPR\//.test(navigator.userAgent);

    const [dismissed, setDismissed] = useState(
        () => sessionStorage.getItem('chrome_warning_dismissed') === 'true'
    );

    const dismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('chrome_warning_dismissed', 'true');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(window.location.href).catch(() => {
            // Fallback for some mobile browsers
            const input = document.createElement('input');
            input.value = window.location.href;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        });
    };

    return (
        <div className="app-root-container">
            {!isChrome && !dismissed && (
                <div className="chrome-guard-banner">
                    <div className="chrome-guard-banner-content">
                        <span className="chrome-guard-banner-icon">⚠️</span>
                        <div className="chrome-guard-banner-text">
                            <strong>浏览器兼容性提示：</strong>
                            推荐使用 Chrome 浏览器以获得完整语音体验。
                        </div>
                        <div className="chrome-guard-banner-actions">
                            <button className="chrome-guard-banner-copy" onClick={handleCopy}>
                                📋 复制网址
                            </button>
                            <button className="chrome-guard-banner-close" onClick={dismiss}>✕</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="app-main-content">
                {children}
            </div>
        </div>
    );
}
