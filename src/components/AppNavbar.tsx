import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';

export default function AppNavbar() {
    const { lang } = useLang();
    const nav = translations[lang].nav;
    const location = useLocation();

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-logo"><span>aIELTS</span></Link>
            <div className="navbar-links">
                <Link to="/" className={location.pathname === '/' ? 'active' : ''}>{nav.home}</Link>
                <Link to="/prompts" className={location.pathname === '/prompts' ? 'active' : ''}>
                    {lang === 'zh' ? '💡 AI提示词' : '💡 Prompt Hub'}
                </Link>
                <Link to="/practice" className={location.pathname.startsWith('/practice') ? 'active' : ''}>{nav.practice}</Link>
                <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>{nav.settings}</Link>
            </div>
        </nav>
    );
}
