import Sidebar from './Sidebar';

const DashboardLayout = ({ children, role }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar role={role} />

            {/* Main Content Area */}
            {/* Added ml-64 to push content right on desktop */}
            <main className="md:ml-64 min-h-screen transition-all duration-300">
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
