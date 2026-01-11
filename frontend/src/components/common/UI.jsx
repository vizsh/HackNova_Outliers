// Card Component
export const Card = ({ children, title, action, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
        {(title || action) && (
            <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
                {title && <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>}
                {action && <div>{action}</div>}
            </div>
        )}
        <div className="p-6">
            {children}
        </div>
    </div>
);

// Status Badge Component
export const StatusBadge = ({ status }) => {
    const styles = {
        pending: 'bg-amber-100 text-amber-700 border-amber-200',
        assigned: 'bg-blue-100 text-blue-700 border-blue-200',
        picked_up: 'bg-purple-100 text-purple-700 border-purple-200',
        in_transit: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        cancelled: 'bg-red-100 text-red-700 border-red-200',
        paid: 'bg-emerald-50 text-emerald-600 border-emerald-200 font-bold'
    };

    const statusKey = status?.toLowerCase().replace(' ', '_');
    const activeStyle = styles[statusKey] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${activeStyle} capitalize`}>
            {status}
        </span>
    );
};
