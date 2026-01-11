import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Map as MapIcon,
    Package,
    Users,
    Truck,
    Settings,
    LogOut,
    FileText,
    Menu,
    X,
    Brain,
    Route,
    DollarSign,
    TrendingUp
} from 'lucide-react';
import { useState } from 'react';

const Sidebar = ({ role }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    // Define menu items based on Role
    const menuItems = {
        operator: [
            { name: 'Dashboard', path: '/operator', icon: LayoutDashboard },
            { name: 'Shipments', path: '/operator/shipments', icon: Package },
            { name: 'Fleet', path: '/operator/fleet', icon: Truck },
            { name: 'Drivers', path: '/operator/drivers', icon: Users },
            { name: 'Documents', path: '/operator/documents', icon: FileText },
            // NEW: Intelligence sections
            { name: 'Actionable Insights', path: '/operator/intelligence/insights', icon: Brain },
            { name: 'Route Suggestions', path: '/operator/intelligence/routes', icon: Route },
            { name: 'Cost Optimization', path: '/operator/intelligence/cost', icon: DollarSign },
            { name: 'Driver Development', path: '/operator/intelligence/drivers', icon: TrendingUp },
        ],
        driver: [
            { name: 'My Jobs', path: '/driver', icon: Truck },
            { name: 'History', path: '/driver/history', icon: FileText },
        ],
        customer: [
            { name: 'Track Shipment', path: '/customer', icon: Package },
            { name: 'My Orders', path: '/customer/orders', icon: FileText },
        ]
    };

    const currentMenu = menuItems[role] || [];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        navigate('/login');
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar Container */}
            <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-slate-700">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Package className="text-blue-500" />
                            SwiftLogistics
                        </h1>
                        <p className="text-xs text-slate-400 mt-1 capitalize">{role} Workspace</p>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-2">
                        {currentMenu.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors
                    ${isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                  `}
                                >
                                    <Icon size={20} />
                                    <span className="font-medium">{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Bottom Actions */}
                    <div className="p-4 border-t border-slate-700">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 p-3 w-full rounded-lg text-slate-300 hover:bg-slate-800 hover:text-red-400 transition-colors"
                        >
                            <LogOut size={20} />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                />
            )}
        </>
    );
};

export default Sidebar;
