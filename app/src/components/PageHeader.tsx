import { useEffect, type ReactNode } from 'react';
import { HeaderMenu } from './HeaderMenu';
import { Sparkle } from './icons';
import { StorageBanner } from './StorageBanner';
import './PageHeader.css';

type Props = {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
};

/** Full-width header: title centered with sparkles, optional actions pinned to either side. */
export function PageHeader({ title, left, right }: Props) {
  useEffect(() => {
    document.title = title === 'Build your outfit' ? title : `${title} · Build your outfit`;
  }, [title]);

  return (
    <>
      <header className="page-header">
        <div className="page-header__side page-header__side--left">{left}</div>
        <div className="page-header__title">
          <Sparkle size={18} color="var(--sparkle-gold)" />
          <h1>{title}</h1>
          <Sparkle size={14} color="var(--sparkle-sky)" />
        </div>
        <div className="page-header__side page-header__side--right">
          {right}
          <HeaderMenu />
        </div>
      </header>
      <StorageBanner />
    </>
  );
}
