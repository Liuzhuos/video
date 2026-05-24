import { Link, useLocation } from 'react-router-dom';
import { APP_LIST } from '../config/apps';

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="w-48 flex-shrink-0 bg-runway-black border-r border-runway-border flex flex-col overflow-y-auto">
      <div className="px-3 py-4">
        <span className="text-xs font-medium text-runway-mid-slate px-2 uppercase tracking-wider">应用</span>
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {APP_LIST.map((app) => {
          const Icon = app.icon;
          const isActive = location.pathname === app.path;
          return (
            <Link
              key={app.id}
              to={app.available ? app.path : '#'}
              onClick={(e) => !app.available && e.preventDefault()}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-runway-surface text-white'
                  : app.available
                  ? 'text-runway-slate hover:text-white hover:bg-runway-surface/50'
                  : 'text-runway-mid-slate/50 cursor-not-allowed'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{app.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
