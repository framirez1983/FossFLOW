import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './styles.css';
import { supportedLanguages } from '../../i18n';

const ChangeLanguage = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en-US');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
    setIsOpen(false);
    localStorage.setItem('i18nextLng', lang);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="language-selector" ref={dropdownRef}>
      <div
        className="language-display"
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen((prev) => !prev);
          } else if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      >
        A/文
      </div>
      {isOpen && (
        <div className="language-dropdown" role="listbox">
          {supportedLanguages.map(item => (
            <div
              key={item.value}
              role="option"
              aria-selected={currentLang === item.value}
              className={`language-option ${currentLang === item.value ? 'active' : ''}`}
              onClick={() => changeLanguage(item.value)}
            >
              {item.label}
            </div>
          ))
          }
        </div>
      )}
    </div>
  );
};

export default ChangeLanguage;
