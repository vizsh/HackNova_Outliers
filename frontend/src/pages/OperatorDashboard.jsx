import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, StatusBadge } from '../components/common/UI';
import { Plus, Zap, Activity, FileText, Map, X, Truck, Anchor, Plane, Download, Upload, CheckCircle, Trash2 } from 'lucide-react';
import socket from '../utils/socket';
// NEW: Intelligence components
import ActionableInsights from './intelligence/ActionableInsights';
import OptimalRouteSuggestions from './intelligence/OptimalRouteSuggestions';
import CostOptimization from './intelligence/CostOptimization';
import DriverDevelopment from './intelligence/DriverDevelopment';
// NEW: Chatbot component
import Chatbot from '../components/chatbot/Chatbot';

const OperatorDashboard = () => {
    const [shipments, setShipments] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [vehicles, setVehicles] = useState([]);

    const location = useLocation();
    const currentPath = location.pathname;
    const isShipmentsView = currentPath.includes('/shipments');
    const isFleetView = currentPath.includes('/fleet');
    const isDocumentsView = currentPath.includes('/documents');
    const isDriversView = currentPath.includes('/drivers');
    // NEW: Intelligence views (clearly separated)
    const isIntelligenceView = currentPath.includes('/intelligence');
    const isActionableInsights = currentPath.includes('/intelligence/insights');
    const isRouteSuggestions = currentPath.includes('/intelligence/routes');
    const isCostOptimization = currentPath.includes('/intelligence/cost');
    const isDriverDevelopment = currentPath.includes('/intelligence/drivers');
    const isCommandCenter = !isShipmentsView && !isFleetView && !isDocumentsView && !isDriversView && !isIntelligenceView;

    // Modals & Forms
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showVehicleForm, setShowVehicleForm] = useState(false);
    const [selectedFleetType, setSelectedFleetType] = useState(null); // 'road', 'air', 'water'
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [assigningShipment, setAssigningShipment] = useState(null);

    const [formData, setFormData] = useState({
        tracking_number: '', origin: '', destination: '',
        pickup_lat: '', pickup_lng: '', drop_lat: '', drop_lng: '',
        customer_id: ''
    });
    const [vehicleForm, setVehicleForm] = useState({
        model: '', license_plate: '', type: 'road', capacity: '', storage_type: 'ambient'
    });

    const navigate = useNavigate();

    const fetchAll = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        
        const config = { headers: { Authorization: `Bearer ${token}` } };
        try {
            const [shipmentsRes, driversRes, vehiclesRes, customersRes] = await Promise.all([
                axios.get('http://localhost:3000/api/data/shipments', config),
                axios.get('http://localhost:3000/api/data/drivers', config),
                axios.get('http://localhost:3000/api/data/vehicles', config),
                axios.get('http://localhost:3000/api/data/customers', config)
            ]);
            setShipments(shipmentsRes.data);
            setDrivers(driversRes.data);
            setVehicles(vehiclesRes.data);
            setCustomers(customersRes.data);
        } catch (err) {
            console.error('Error fetching data', err);
            // Only logout on explicit auth failure (401/403), NOT on network errors or 500s
            if (err.response?.status === 401 || err.response?.status === 403) {
                // Only clear token and redirect if it's a real auth error
                const token = localStorage.getItem('token');
                if (token) {
                    try {
                        const { jwtDecode } = await import('jwt-decode');
                        const decoded = jwtDecode(token);
                        // Token might be expired or invalid
                        localStorage.removeItem('token');
                        localStorage.removeItem('userId');
                    } catch (e) {
                        localStorage.removeItem('token');
                        localStorage.removeItem('userId');
                    }
                }
                navigate('/login');
            }
            // For other errors (network, 500, etc.), just log but don't redirect
        }
    };

    useEffect(() => {
        fetchAll();
    }, [navigate]);

    const handleCreateShipment = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post('http://localhost:3000/api/data/shipments', formData, { headers: { Authorization: `Bearer ${token}` } });
            alert('Shipment Created!');
            setShowCreateForm(false);
            fetchAll();
        } catch (err) { alert('Error creating shipment'); }
    };

    const handleAssignDriver = async (shipmentId, driverId) => {
        const token = localStorage.getItem('token');
        try {
            await axios.put(`http://localhost:3000/api/data/shipments/${shipmentId}/assign`, { driver_id: driverId }, { headers: { Authorization: `Bearer ${token}` } });
            setAssigningShipment(null);
            fetchAll();
        } catch (err) { alert('Error assigning driver'); }
    };

    const handleDeleteShipment = async (shipmentId) => {
        if (!confirm('Are you sure you want to delete this shipment?')) return;
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:3000/api/data/shipments/${shipmentId}`, { headers: { Authorization: `Bearer ${token}` } });
            // Optimistic update
            setShipments(prev => prev.filter(s => s.id !== shipmentId));
            fetchAll();
        } catch (err) { alert('Error deleting shipment'); }
    };

    const handleDownloadPDF = async (shipmentId) => {
        const token = localStorage.getItem('token');
        try {
            const response = await axios.get(`http://localhost:3000/api/documents/invoice/${shipmentId}`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            
            // Create blob URL and download
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/html' }));
            const link = document.createElement('a');
            link.href = url;
            
            // Get tracking number for filename
            const shipment = shipments.find(s => s.id === shipmentId);
            const filename = shipment ? `invoice_${shipment.tracking_number}.html` : `invoice_${shipmentId}.html`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            // Open in new window for print/save as PDF
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print(); // User can save as PDF from print dialog
                };
            }
        } catch (err) {
            console.error('Error downloading invoice:', err);
            alert('Failed to download invoice. Please try again.');
        }
    };

    const handleUploadDoc = () => {
        // Mock Upload
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = () => {
            alert('Document uploaded successfully! (Mock)');
        };
        input.click();
    };

    const getDashboardTitle = () => {
        if (isShipmentsView) return 'Shipment Management';
        if (isFleetView) return 'Fleet Management';
        if (isDocumentsView) return 'Document Center';
        if (isDriversView) return 'Driver Roster';
        return 'Dispatch Command Center';
    };

    // NEW: Render intelligence sections separately (clearly separated, not modifying existing dashboards)
    if (isIntelligenceView) {
        if (isActionableInsights) return <ActionableInsights />;
        if (isRouteSuggestions) return <OptimalRouteSuggestions />;
        if (isCostOptimization) return <CostOptimization />;
        if (isDriverDevelopment) return <DriverDevelopment />;
        // Default to actionable insights if intelligence path but no specific section
        return <ActionableInsights />;
    }

    return (
        <DashboardLayout role="operator">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{getDashboardTitle()}</h1>
                    <p className="text-slate-500">Overview of your operations</p>
                </div>
                {isCommandCenter && (
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                        <Plus size={20} /> New Shipment
                    </button>
                )}
            </div>

            {/* Stats Grid - ONLY on Command Center */}
            {isCommandCenter && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <Card className="border-l-4 border-blue-500">
                        <div className="text-slate-500 text-sm">Active Shipments</div>
                        <div className="text-2xl font-bold text-slate-800">{shipments.filter(s => s.status === 'in_transit').length}</div>
                    </Card>
                    <Card className="border-l-4 border-green-500">
                        <div className="text-slate-500 text-sm">Top Talent</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {drivers.filter(d => d.level === 'ELITE').length} <span className="text-sm font-normal text-slate-500">Elite</span>
                        </div>
                    </Card>
                    <Card className="border-l-4 border-purple-500">
                        <div className="text-slate-500 text-sm">Fleet Status</div>
                        <div className="text-2xl font-bold text-slate-800">{vehicles.length} Units</div>
                    </Card>
                    <Card className="border-l-4 border-amber-500">
                        <div className="text-slate-500 text-sm">Pending Alerts</div>
                        <div className="text-2xl font-bold text-slate-800">3</div>
                    </Card>
                </div>
            )}

            {/* Main Content Area */}
            <div className="space-y-6">

                {/* COMMAND CENTER: Map & Summaries */}
                {isCommandCenter && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            {showCreateForm && (
                                <Card title="New Shipment Details">
                                    <form onSubmit={handleCreateShipment} className="grid grid-cols-2 gap-4">
                                        <input className="border p-2 rounded" placeholder="Tracking #" onChange={e => setFormData({ ...formData, tracking_number: e.target.value })} required />
                                        <div className="border p-2 rounded bg-gray-50 flex items-center text-gray-400">Auto-Generated ID</div>

                                        <input className="border p-2 rounded" placeholder="Origin Address" onChange={e => setFormData({ ...formData, origin: e.target.value })} required />
                                        <input className="border p-2 rounded" placeholder="Destination Address" onChange={e => setFormData({ ...formData, destination: e.target.value })} required />

                                        <div className="col-span-2 grid grid-cols-3 gap-4">
                                            <select className="border p-2 rounded" onChange={e => setFormData({ ...formData, freight_type: e.target.value })} required>
                                                <option value="">Select Freight Type</option>
                                                <option value="Standard">Standard</option>
                                                <option value="Fragile">Fragile</option>
                                                <option value="Hazardous">Hazardous</option>
                                                <option value="Perishable">Perishable</option>
                                                <option value="Oversized">Oversized</option>
                                            </select>
                                            <input type="number" className="border p-2 rounded" placeholder="Weight (kg)" onChange={e => setFormData({ ...formData, weight: e.target.value })} required />
                                            <input type="datetime-local" className="border p-2 rounded" onChange={e => setFormData({ ...formData, deadline: e.target.value })} required />
                                        </div>

                                        {/* Coordinates Input */}
                                        <div className="col-span-2 grid grid-cols-4 gap-2">
                                            <input className="border p-2 rounded text-sm" placeholder="Pickup Lat" onChange={e => setFormData({ ...formData, pickup_lat: e.target.value })} />
                                            <input className="border p-2 rounded text-sm" placeholder="Pickup Lng" onChange={e => setFormData({ ...formData, pickup_lng: e.target.value })} />
                                            <input className="border p-2 rounded text-sm" placeholder="Drop Lat" onChange={e => setFormData({ ...formData, drop_lat: e.target.value })} />
                                            <input className="border p-2 rounded text-sm" placeholder="Drop Lng" onChange={e => setFormData({ ...formData, drop_lng: e.target.value })} />
                                        </div>

                                        <select className="border p-2 rounded col-span-2" onChange={e => setFormData({ ...formData, customer_id: e.target.value })} required>
                                            <option value="">Select Customer</option>
                                            {customers.map(c => <option key={c.id} value={c.id}>{c.email}</option>)}
                                        </select>

                                        <div className="col-span-2 flex items-center gap-2 border p-3 rounded bg-gray-50">
                                            <input
                                                type="checkbox"
                                                id="paymentLock"
                                                className="w-4 h-4"
                                                onChange={e => setFormData({ ...formData, payment_locked: e.target.checked })}
                                            />
                                            <label htmlFor="paymentLock" className="text-sm text-slate-700 font-medium">
                                                Lock Payment (Customer cannot pay until unlocked)
                                            </label>
                                        </div>

                                        <button className="bg-blue-600 text-white p-2 rounded col-span-2 font-medium">Confirm Creation</button>
                                    </form>
                                </Card>
                            )}
                            <Card title="Live Network Map">
                                <div className="h-[500px] bg-slate-100 rounded-lg overflow-hidden border border-slate-200 rounded-lg">
                                    <MapComponent shipments={shipments} drivers={drivers} showDriverLocation={false} />
                                </div>
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Map Legend</div>
                                    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                                            <span>Pickup Point</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                                            <span>Destination</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                                            <span>Driver Location</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-6 bg-blue-600"></div>
                                            <span>Route</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                        <div className="space-y-6">
                            <Card title="Recent Activity">
                                <ul className="space-y-3">
                                    {shipments.slice(0, 5).map(s => (
                                        <li key={s.id} className="text-sm border-b pb-2 last:border-0">
                                            <span className="font-bold">{s.tracking_number}</span>: <StatusBadge status={s.status} />
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        </div>
                    </div>
                )}

                {/* DRIVERS VIEW */}
                {isDriversView && (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Driver Status</h2>
                            <div className="bg-slate-100 px-3 py-1 rounded-full text-sm font-medium">
                                {drivers.filter(d => d.active_shipment).length} / {drivers.length} Drivers Busy
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {drivers.map(d => (
                                <div
                                    key={d.id}
                                    onClick={() => setSelectedDriver(d)}
                                    className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-400 transition group"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl group-hover:bg-blue-600 group-hover:text-white transition">
                                            {d.email[0].toUpperCase()}
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-bold ${d.active_shipment ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                            {d.active_shipment ? 'BUSY' : 'AVAIL'}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-800">{d.email}</h3>
                                    {d.active_shipment ? (
                                        <div className="text-xs mt-1 bg-amber-50 text-amber-800 px-2 py-1 rounded inline-block border border-amber-100">
                                            🚛 {d.active_shipment.tracking_number}
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-sm">Level: {d.level}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* FLEET VIEW */}
                {isFleetView && (
                    <>
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => setShowVehicleForm(true)}
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-700"
                            >
                                <Plus size={20} /> Add Unit
                            </button>
                        </div>

                        {showVehicleForm && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-xl font-bold">Add Fleet Unit</h2>
                                        <button onClick={() => setShowVehicleForm(false)}><X size={24} /></button>
                                    </div>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        try {
                                            await axios.post('http://localhost:3000/api/data/vehicles', vehicleForm, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                                            alert('Vehicle Added!'); setShowVehicleForm(false); fetchAll();
                                        } catch (e) { alert('Error'); }
                                    }} className="space-y-4">
                                        <select className="w-full border p-2 rounded" onChange={e => setVehicleForm({ ...vehicleForm, type: e.target.value })}>
                                            <option value="road">Road</option><option value="air">Air</option><option value="water">Water</option>
                                        </select>
                                        <input className="w-full border p-2 rounded" placeholder="Model" onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
                                        <input className="w-full border p-2 rounded" placeholder="License Plate" onChange={e => setVehicleForm({ ...vehicleForm, license_plate: e.target.value })} />
                                        <input className="w-full border p-2 rounded" placeholder="Capacity" onChange={e => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} />
                                        <button className="w-full bg-green-600 text-white p-2 rounded font-bold">Save Unit</button>
                                    </form>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { type: 'road', icon: Truck, label: 'Road Fleet', color: 'bg-blue-50 text-blue-600' },
                                { type: 'air', icon: Plane, label: 'Air Freight', color: 'bg-sky-50 text-sky-600' },
                                { type: 'water', icon: Anchor, label: 'Maritime', color: 'bg-indigo-50 text-indigo-600' }
                            ].map(cat => (
                                <div
                                    key={cat.type}
                                    onClick={() => setSelectedFleetType(cat.type)}
                                    className={`p-6 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md transition bg-white flex items-center gap-4`}
                                >
                                    <div className={`p-4 rounded-full ${cat.color}`}>
                                        <cat.icon size={32} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-800">{cat.label}</h3>
                                        <p className="text-slate-500">{vehicles.filter(v => v.type === cat.type).length} Units Active</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* DOCUMENTS VIEW */}
                {isDocumentsView && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 1. Invoices */}
                        <Card title="Invoices">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-xs uppercase text-slate-500">
                                    <tr><th>Ref</th><th>Amt</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {shipments.filter(s => s.status === 'delivered').map(s => (
                                        <tr key={s.id} className="border-b">
                                            <td className="px-3 py-2">{s.tracking_number}</td>
                                            <td className="px-3 py-2">₹{s.invoice_amount}</td>
                                            <td className="px-3 py-2">
                                                <button onClick={() => handleDownloadPDF(s.id)} className="text-blue-600 flex items-center gap-1 hover:underline">
                                                    <Download size={14} /> PDF
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>

                        {/* 2. Proof of Delivery */}
                        <Card title="Proof of Delivery (POD)">
                            <div className="space-y-4">
                                {shipments.filter(s => s.status === 'delivered').map(s => (
                                    <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                                        <div>
                                            <div className="font-bold text-slate-800">{s.tracking_number}</div>
                                            <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={10} /> Delivered</div>
                                        </div>
                                        <button onClick={handleDownloadPDF} className="text-xs bg-white border px-2 py-1 rounded shadow-sm hover:bg-gray-50 flex items-center gap-1">
                                            <FileText size={12} /> View POD
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* 3. Pending Uploads */}
                        <Card title="Compliance & Uploads" className="md:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {shipments.filter(s => s.status !== 'delivered').map(s => (
                                    <div key={s.id} className="p-4 border rounded dashed border-slate-300 bg-slate-50 flex flex-col justify-center items-center text-center gap-2">
                                        <div className="font-bold text-slate-700">{s.tracking_number}</div>
                                        <div className="text-xs text-slate-500">Missing Manifest</div>
                                        <button onClick={handleUploadDoc} className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-2 hover:bg-blue-700 transition">
                                            <Upload size={12} /> Upload Doc
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}

                {/* SHIPMENTS VIEW (Clean Table) */}
                {isShipmentsView && (
                    <Card title="All Shipments Directory">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-xs uppercase text-slate-500"><tr><th>ID</th><th>Status</th><th>Driver</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {shipments.map(s => (
                                        <tr key={s.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">{s.tracking_number}</td>
                                            <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                                            <td className="px-4 py-3">
                                                {s.status === 'pending' || !s.driver_id ? (
                                                    <button
                                                        onClick={() => setAssigningShipment(s)}
                                                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 shadow-sm transition flex items-center gap-1"
                                                    >
                                                        <Plus size={14} /> Assign Driver
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium">Driver #{s.driver_id}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleDeleteShipment(s.id)}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                                    title="Delete Shipment"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

            </div>

            {/* MODAL: FLEET DETAILS */}
            {selectedFleetType && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedFleetType(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold capitalize">{selectedFleetType} Fleet</h2>
                            <button onClick={() => setSelectedFleetType(null)}><X size={24} /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vehicles.filter(v => v.type === selectedFleetType).map(v => (
                                <div key={v.id} className="p-4 border rounded-lg bg-gray-50">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-lg">{v.model}</div>
                                            <div className="text-mono text-slate-500 text-sm">{v.license_plate}</div>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{v.status}</div>
                                    </div>
                                    <div className="mt-4 flex gap-2 text-xs text-slate-600">
                                        <span className="bg-white px-2 py-1 rounded border">📦 {v.capacity}</span>
                                        <span className="bg-white px-2 py-1 rounded border">🌡️ {v.storage_type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: DRIVER DETAILS */}
            {selectedDriver && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDriver(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold">
                                    {selectedDriver.email[0].toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedDriver.email}</h2>
                                    <span className="text-slate-500">ID: #{selectedDriver.id}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDriver(null)}><X size={24} /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <span className="block text-sm text-slate-500 mb-1">Skill Index</span>
                                <span className="text-xl font-bold text-slate-800">{selectedDriver.skill_index}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <span className="block text-sm text-slate-500 mb-1">Current Status</span>
                                <span className={`text-xl font-bold ${selectedDriver.active_shipment ? 'text-amber-600' : 'text-green-600'}`}>
                                    {selectedDriver.active_shipment ? 'BUSY' : 'AVAILABLE'}
                                </span>
                            </div>
                        </div>

                        <h3 className="font-bold text-lg mb-4">Current Assignment</h3>
                        {selectedDriver.active_shipment ? (
                            <div className="p-4 border border-blue-100 bg-blue-50 rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-blue-900">{selectedDriver.active_shipment.tracking_number}</div>
                                    <div className="text-sm text-blue-700">{selectedDriver.active_shipment.origin} → {selectedDriver.active_shipment.destination}</div>
                                </div>
                                <button onClick={() => {
                                    try {
                                        // Use shared socket
                                        socket.emit('operator:request-location', { driverId: selectedDriver.id });
                                        alert('Tracking request sent!');
                                    } catch (e) { }
                                }} className="bg-white text-blue-600 px-3 py-1.5 rounded text-sm font-bold shadow-sm">
                                    📍 Locate
                                </button>
                            </div>
                        ) : (
                            <div className="text-slate-500 italic">No active assignment.</div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: ASSIGN DRIVER (Rich Interface) */}
            {assigningShipment && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setAssigningShipment(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Select Driver for Shipment</h2>
                                <p className="text-slate-500 text-sm">Shipment ID: {assigningShipment.tracking_number} • {assigningShipment.origin} → {assigningShipment.destination}</p>
                            </div>
                            <button onClick={() => setAssigningShipment(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={24} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto bg-slate-50 h-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {drivers.map(d => (
                                    <div
                                        key={d.id}
                                        onClick={() => {
                                            if (!d.active_shipment) {
                                                if (confirm(`Confirm assignment of ${d.name} (${d.email})?`)) {
                                                    handleAssignDriver(assigningShipment.id, d.id);
                                                }
                                            } else {
                                                alert('This driver is currently busy.');
                                            }
                                        }}
                                        className={`group relative bg-white p-5 rounded-xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${d.active_shipment
                                            ? 'border-gray-100 opacity-60 cursor-not-allowed bg-gray-50'
                                            : 'border-white hover:border-blue-500'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${d.active_shipment ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                                                    {d.name ? d.name[0] : d.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{d.name || d.email}</h3>
                                                    <p className="text-xs text-slate-400 font-mono mt-1">{d.email}</p>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${d.active_shipment ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                {d.active_shipment ? 'BUSY' : 'AVAILABLE'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 py-3 border-t border-gray-50">
                                            <div className="text-center">
                                                <div className="text-xs text-slate-400 uppercase font-bold">Age</div>
                                                <div className="font-semibold text-slate-700">{d.age || 'N/A'}</div>
                                            </div>
                                            <div className="text-center border-l border-gray-100">
                                                <div className="text-xs text-slate-400 uppercase font-bold">Exp</div>
                                                <div className="font-semibold text-slate-700">{d.experience || 'N/A'}</div>
                                            </div>
                                            <div className="text-center border-l border-gray-100">
                                                <div className="text-xs text-slate-400 uppercase font-bold">Rating</div>
                                                <div className="font-semibold text-slate-700 flex items-center justify-center gap-1">
                                                    {d.skill_index} <span className="text-yellow-500 text-[10px]">★</span>
                                                </div>
                                            </div>
                                        </div>

                                        {d.active_shipment && (
                                            <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded text-center">
                                                Current Mission: {d.active_shipment.tracking_number}
                                            </div>
                                        )}

                                        {!d.active_shipment && (
                                            <div className="absolute inset-x-0 bottom-0 p-3 bg-blue-600 text-white text-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
                                                CLICK TO ASSIGN
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Chatbot Component */}
            <Chatbot role="operator" />
        </DashboardLayout>
    );
};

export default OperatorDashboard;
