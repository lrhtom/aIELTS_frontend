import { type ReactNode, useState } from 'react';
import '../../styles/ChromeOnlyGuard.css';

export default function ChromeOnlyGuard({ children }: { children: ReactNode }) {
    // A more strict check for Google Chrome (avoiding Edge, Opera, Brave, etc. if possible, or allowing generic Chromium if preferred,
    // but the user specifically asked for Google Chrome).
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    // We also consider an override just in case the user gets completely stuck,
    // but the prompt asked to *always* block and show a button. We will strictly block non-Chrome.
    const [copied, setCopied] = useState(false);

    if (isChrome) {
        return <>{children}</>;
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="chrome-guard-overlay">
            <div className="chrome-guard-card">
                <div className="chrome-guard-icon">⚠️</div>
                <h1 className="chrome-guard-title">浏览器不兼容</h1>
                <p className="chrome-guard-desc">
                    很抱歉！本系统的核心口语对话与识别引擎（Web Speech API & RecordRTC）专门针对 <strong>Google Chrome (谷歌浏览器)</strong> 进行了深度优化与适配。您当前使用的浏览器可能会导致录音失败或评分功能受限。
                </p>
                <div className="chrome-guard-actions">
                    <button className="chrome-btn-copy" onClick={handleCopy}>
                        {copied ? '✅ 链接已复制' : '🔗 复制当前网址'}
                    </button>
                    <a
                        className="chrome-btn-download"
                        href="https://www.google.com/chrome/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        🌐 下载 Google Chrome
                    </a>
                </div>
                <div className="chrome-guard-footer">
                    *请复制网址后，手动打开您电脑上的 Google Chrome 浏览器并粘贴访问。
                </div>
            </div>
        </div>
    );
}
