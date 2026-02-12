import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'OVERVIEW', key: '1' },
  { to: '/agents', label: 'AGENTS', key: '2' },
  { to: '/workflows', label: 'WORKFLOWS', key: '3' },
  { to: '/chat', label: 'CHAT', key: '4' },
  { to: '/ops', label: 'OPS', key: '5' },
  { to: '/costs', label: 'COSTS', key: '6' },
  { to: '/performance', label: 'PERF', key: '7' },
  { to: '/tasks', label: 'TASKS', key: '8' },
];

export function TabNav() {
  return (
    <nav className="tab-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `tab-nav__item ${isActive ? 'tab-nav__item--active' : ''}`}
        >
          <span className="tab-nav__key">[{tab.key}]</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
