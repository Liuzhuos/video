import { useNavigate } from 'react-router-dom';
import { APP_LIST } from '../config/apps';

export default function AppsPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white mb-2">应用中心</h2>
        <p className="text-runway-slate text-sm">探索 AI 驱动的创作工具</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {APP_LIST.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.id}
              onClick={() => app.available && navigate(app.path)}
              className={`bg-runway-surface border border-runway-border rounded-lg p-6 transition-all ${
                app.available
                  ? 'cursor-pointer hover:border-runway-charcoal hover:shadow-lg hover:-translate-y-0.5'
                  : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  app.available ? 'bg-white/10' : 'bg-white/5'
                }`}>
                  <Icon className={`w-5 h-5 ${app.available ? 'text-white' : 'text-runway-mid-slate'}`} />
                </div>
                {!app.available && (
                  <span className="text-xs text-runway-mid-slate bg-runway-border/50 px-2 py-0.5 rounded">
                    即将上线
                  </span>
                )}
              </div>
              <h3 className={`font-medium mb-2 ${app.available ? 'text-white' : 'text-runway-slate'}`}>
                {app.name}
              </h3>
              <p className="text-sm text-runway-mid-slate leading-relaxed">
                {app.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
