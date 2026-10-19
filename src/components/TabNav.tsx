import { useState, useEffect, useRef, useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS, filterNavigationItems, isNavigationItemActive } from '../lib/navigation';
import type { NavigationGroup, NavigationItem } from '../lib/navigation';
import { useNavigationPreferences } from '../hooks/useNavigationPreferences';

interface TabNavProps {
  onShellToggle: () => void;
  shellOpen: boolean;
}

export function TabNav({ onShellToggle, shellOpen }: TabNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<NavigationGroup | null>(null);
  const [query, setQuery] = useState('');
  const { favoriteIds, toggleFavorite } = useNavigationPreferences();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = `navigation-panel${useId()}`;
  const overview = NAVIGATION_ITEMS[0];
  const matches = filterNavigationItems(query);
  const visibleItems = query.trim() ? matches : matches.filter(item => !selectedGroup || item.group === selectedGroup);
  const favorites = NAVIGATION_ITEMS.filter(item => favoriteIds.includes(item.id));

  function closeMenu(restoreFocus = false) {
    setMenuOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function openMenu(trigger: HTMLButtonElement, group: NavigationGroup | null) {
    triggerRef.current = trigger;
    setQuery('');
    setSelectedGroup(group);
    setMenuOpen(current => !(current && selectedGroup === group));
  }

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search, location.hash]);
  useEffect(() => { if (menuOpen) searchRef.current?.focus(); }, [menuOpen, selectedGroup]);
  useEffect(() => {
    if (!menuOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        closeMenu(true);
      }
    }
    function handleOutside(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) closeMenu();
    }
    function handleResize() { if (window.innerWidth > 768) closeMenu(); }
    window.addEventListener('keydown', handleKey);
    window.addEventListener('pointerdown', handleOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [menuOpen]);

  function destination(item: NavigationItem) {
    const active = item.action === 'shell' ? shellOpen : isNavigationItemActive(item, location.pathname);
    const className = `tab-nav__item${active ? ' tab-nav__item--active' : ''}`;
    const label = <>{item.shortcut && <span className="tab-nav__key" aria-hidden="true">[{item.shortcut}]</span>}{item.label}</>;
    if (item.action === 'shell') return <button type="button" className={className} aria-label="Toggle Shell" aria-pressed={shellOpen} onClick={() => { closeMenu(true); onShellToggle(); }}>{label}</button>;
    if (item.external) return <a className={className} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => closeMenu(true)}>{label}<span className="tab-nav__external" aria-label="opens in a new tab">↗</span></a>;
    return <Link className={className} to={item.href} aria-current={active ? 'page' : undefined} onClick={() => closeMenu(true)}>{label}</Link>;
  }

  function itemRow(item: NavigationItem) {
    const favorite = favoriteIds.includes(item.id);
    return <li className="tab-nav__row" key={item.id}>
      {destination(item)}
      <button type="button" className="tab-nav__favorite" aria-label={`${favorite ? 'Remove' : 'Add'} ${item.label} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => toggleFavorite(item.id)}>{favorite ? '★' : '☆'}</button>
    </li>;
  }

  return <nav ref={navRef} className={`tab-nav${menuOpen ? ' tab-nav--open' : ''}`} aria-label="Primary navigation">
    <div className="tab-nav__bar">
      {destination(overview)}
      <button type="button" className="tab-nav__mobile-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls={panelId} onClick={event => openMenu(event.currentTarget, null)}>Menu</button>
      <div className="tab-nav__groups">
        {NAVIGATION_GROUPS.map(group => <button type="button" key={group} className="tab-nav__group-toggle" aria-label={`${group} navigation`} data-active={NAVIGATION_ITEMS.some(item => item.group === group && (item.action === 'shell' ? shellOpen : isNavigationItemActive(item, location.pathname)))} aria-expanded={menuOpen && selectedGroup === group} aria-controls={panelId} onClick={event => openMenu(event.currentTarget, group)}>{group}</button>)}
      </div>
      <button type="button" className="tab-nav__search-toggle" aria-expanded={menuOpen && selectedGroup === null} aria-controls={panelId} onClick={event => openMenu(event.currentTarget, null)}>Search &amp; favorites</button>
    </div>
    <div className="tab-nav__panel" id={panelId} hidden={!menuOpen}>
      <div className="tab-nav__search-row">
        <input ref={searchRef} type="search" aria-label="Search navigation" placeholder="Search all destinations" value={query} onChange={event => setQuery(event.target.value)} />
        <button type="button" className="tab-nav__close" aria-label="Close navigation" onClick={() => closeMenu(true)}>Close</button>
      </div>
      {!query.trim() && <section className="tab-nav__section" aria-label="Favorites">
        <h2>Favorites</h2>
        {favorites.length ? <ul>{favorites.map(itemRow)}</ul> : <p>No favorites yet. Use a star to keep a destination here.</p>}
      </section>}
      {query.trim() ? <section className="tab-nav__section" aria-label="Search results">
        <h2>Search results</h2>
        {visibleItems.length ? <ul>{visibleItems.map(itemRow)}</ul> : <p role="status">No matching destinations.</p>}
      </section> : <div className="tab-nav__sections">
        {NAVIGATION_GROUPS.filter(group => !selectedGroup || group === selectedGroup).map(group => <section className="tab-nav__section" key={group} aria-label={`${group} destinations`}>
          <h2>{group}</h2><ul>{visibleItems.filter(item => item.group === group).map(itemRow)}</ul>
        </section>)}
      </div>}
    </div>
  </nav>;
}
