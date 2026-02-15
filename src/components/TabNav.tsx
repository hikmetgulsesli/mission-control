import { NavLink } from 'react-router-dom';

const tabs: { to: string; label: string; key?: string }[] = [
  { to: '/', label: 'OVERVIEW' },
  { to: '/office', label: 'OFFICE', key: '0' },
  { to: '/agents', label: 'AGENTS', key: '1' },
  { to: '/chat', label: 'CHAT', key: '2' },
  { to: '/ops', label: 'OPS', key: '3' },
  { to: '/costs', label: 'COSTS', key: '4' },
  { to: '/performance', label: 'PERF', key: '5' },
  { to: '/projects', label: 'PROJECTS', key: '6' },
  { to: '/files', label: 'FILES', key: '7' },
];

interface TabNavProps {
  onShellToggle: () => void;
  shellOpen: boolean;
}

export function TabNav({ onShellToggle, shellOpen }: TabNavProps) {
  return (
    <nav className="tab-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `tab-nav__item ${isActive ? 'tab-nav__item--active' : ''}`}
        >
          {tab.key && <span className="tab-nav__key">[{tab.key}]</span>}
          {tab.label}
        </NavLink>
      ))}
      <button
        className={`tab-nav__item tab-nav__item--shell ${shellOpen ? 'tab-nav__item--active' : ''}`}
        onClick={onShellToggle}
      >
        <span className="tab-nav__key">[8]</span>
        SHELL
      </button>
    </nav>
  );
}
