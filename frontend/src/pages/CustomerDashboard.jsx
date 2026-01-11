import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, StatusBadge } from '../components/common/UI';
import { Search, MapPin, Truck, Check, FileText, CreditCard, Bell, AlertCircle, Download } from 'lucide-react';
// NEW: Customer-facing components
import SmartOrderTracking from '../components/customer/SmartOrderTracking';
import CustomerControls from '../components/customer/CustomerControls';
import GuidedFeedback from '../components/customer/GuidedFeedback';
import CustomerIssueResolution from '../components/customer/CustomerIssueResolution';
import socket from '../utils/socket';
// NEW: Chatbot component
import Chatbot from '../components/chatbot/Chatbot';

const CustomerDashboard = () => {
    const [myShipments, setMyShipments] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [selectedShipmentId, setSelectedShipmentId] = useState(null);
    const [issueData, setIssueData] = useState({ type: 'Delay', description: '' });

    // Rating State
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingData, setRatingData] = useState({ rating: 5, comment: '' });

    // NEW: Listen for proactive notifications (event-driven)
    useEffect(() => {
        const userId = localStorage.getItem('userId');
        if (!userId) return;

        // Subscribe to customer notifications for all shipments
        myShipments.forEach(shipment => {
            if (shipment.id) {
                socket.emit('customer:subscribe', {
                    shipment_id: shipment.id,
                    customer_id: userId
                });
            }
        });

        const handleCustomerNotification = (data) => {
            // Only show notifications for shipments we're tracking
            if (!myShipments.some(s => s.id === data.shipment_id)) return;

            // Add notification to list
            const newNotification = {
                id: Date.now(),
                message: data.message,
                type: data.type || 'info',
                created_at: data.timestamp || new Date().toISOString(),
                read: false
            };
            setNotifications(prev => [newNotification, ...prev]);

            // Show browser notification if permission granted
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Delivery Update', {
                    body: data.message,
                    icon: '/vite.svg'
                });
            }
        };

        // Listen for customer-specific events
        socket.on('customer_notification', handleCustomerNotification);

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => {
            socket.off('customer_notification', handleCustomerNotification);
            // Unsubscribe from notifications
            myShipments.forEach(shipment => {
                if (shipment.id && userId) {
                    socket.emit('customer:unsubscribe', {
                        shipment_id: shipment.id,
                        customer_id: userId
                    });
                }
            });
        };
    }, [myShipments]);

    const location = useLocation();
    const navigate = useNavigate();
    const isInvoicesView = location.pathname.includes('/invoices');

    const fetchAll = async () => {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        try {
            const [shipRes, notifRes] = await Promise.all([
                axios.get('http://localhost:3000/api/data/my-shipments', config),
                axios.get('http://localhost:3000/api/customer/notifications', config)
            ]);
            setMyShipments(shipRes.data);
            setNotifications(notifRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handlePay = async (shipmentId, amount) => {
        const token = localStorage.getItem('token');
        try {
            // 1. Create Order
            const { data } = await axios.post('http://localhost:3000/api/payments/create', {
                shipment_id: shipmentId,
                amount: amount || 500 // Fallback amount
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // 2. Open Razorpay
            const options = {
                key: data.key_id,
                amount: data.amount * 100, // paise
                currency: "INR",
                name: "SwiftLogistics",
                description: `Payment for Shipment #${shipmentId}`,
                order_id: data.razorpay_order_id,
                handler: async function (response) {
                    try {
                        await axios.post('http://localhost:3000/api/payments/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            shipment_id: shipmentId
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        alert('Payment Successful!');
                        fetchAll();
                    } catch (verifyErr) {
                        alert('Payment Verification Failed');
                    }
                },
                theme: {
                    color: "#2563EB"
                },
                modal: {
                    ondismiss: function () {
                        console.log('Checkout form closed');
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

            // Prevent default error if test keys are bad
            rzp.on('payment.failed', function (response) {
                console.error(response.error);
                alert("Payment Failed: " + response.error.description);
            });

        } catch (err) {
            console.error(err);
            alert('Failed to initiate payment. check console.');
        }
    };

    const handleDownload = (type, shipmentId) => {
        const token = localStorage.getItem('token');
        axios.get(`http://localhost:3000/api/customer/documents/${type}/${shipmentId}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        }).then((response) => {
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_${shipmentId}.pdf`);
            document.body.appendChild(link);
            link.click();
        }).catch(() => alert("Download failed"));
    };

    const handleGenerateOTP = (shipmentId) => {
        const shipment = myShipments.find(s => s.id === shipmentId);
        if (shipment && shipment.delivery_code) {
            alert(`Your Delivery Code is: ${shipment.delivery_code}\n\nShare this with the driver only upon arrival.`);
        } else {
            alert(`Your Delivery Code is: 7777\n\nShare this with the driver only upon arrival.`);
        }
    };

    const handleReportIssue = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            await axios.post('http://localhost:3000/api/customer/issues', {
                shipment_id: selectedShipmentId,
                ...issueData
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Issue Reported Successfully');
            setShowIssueModal(false);
        } catch (err) {
            alert('Failed to report issue');
        }
    };

    const handleSubmitRating = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        // Find driver_id for the selected shipment
        const shipment = myShipments.find(s => s.id === selectedShipmentId);
        if (!shipment || !shipment.driver_id) {
            alert('Cannot rate: details missing.');
            return;
        }

        try {
            await axios.post(`http://localhost:3000/api/data/shipments/${selectedShipmentId}/feedback`, {
                driver_id: shipment.driver_id,
                ...ratingData
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('Thank you for your feedback!');
            setShowRatingModal(false);
            // Optionally refresh to remove rating button or show "Rated"
        } catch (err) {
            alert('Failed to submit rating');
        }
    };

    const filteredShipments = isInvoicesView
        ? myShipments.filter(s => s.status === 'delivered')
        : myShipments;

    return (
        <DashboardLayout role="customer">

            {/* Header Area with Notifications */}
            {!isInvoicesView && (
                <div className="flex flex-col md:flex-row gap-8 mb-10">
                    {/* Search Area */}
                    <div className="flex-1 text-center md:text-left">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Track Your Shipment</h1>
                        <p className="text-slate-500 mb-6">Enter your consignment number to track status anytime.</p>
                        <div className="relative max-w-xl">
                            <input
                                type="text"
                                placeholder="Enter Shipment Number..."
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <Search className="absolute left-4 top-4 text-gray-400" />
                            <button className="absolute right-2 top-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">Search</button>
                        </div>
                    </div>

                    {/* Notifications Panel */}
                    <div className="w-full md:w-80">
                        <Card title="Notifications" action={<Bell size={18} className="text-blue-500" />}>
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                {notifications.length === 0 ? <p className="text-xs text-gray-400">No new alerts.</p> : notifications.map(n => (
                                    <div key={n.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs">
                                        <p className="text-slate-700 font-medium mb-1">{n.message}</p>
                                        <div className="text-slate-400 text-[10px]">{new Date(n.created_at).toLocaleTimeString()}</div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            <h2 className="text-xl font-bold text-slate-800 mb-6 px-2 border-l-4 border-blue-600">
                {isInvoicesView ? 'My Invoices' : 'Active Consignments'}
            </h2>

            <div className="space-y-6">
                {filteredShipments.map(s => (
                    <Card key={s.id} className="hover:shadow-md transition">
                        <div className="md:flex gap-8">
                            {/* Left: Shipment Info */}
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            {s.tracking_number}
                                            <StatusBadge status={s.status} />
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">Carrier: SwiftLogistics Premium</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-slate-500">Estimated Delivery</div>
                                        <div className="font-semibold text-slate-800">Jan 15, 2026</div>

                                        {/* Action Buttons */}
                                        {(s.status === 'assigned' || s.status === 'in_transit') && (
                                            <button
                                                onClick={() => handleGenerateOTP(s.id)}
                                                className="mt-2 text-xs bg-slate-900 text-white px-3 py-1 rounded shadow-sm hover:bg-slate-700 transition"
                                            >
                                                Get Delivery Code
                                            </button>
                                        )}
                                        {s.status === 'delivered' && (
                                            <div className="mt-2">
                                                <GuidedFeedback shipment={s} onSubmitted={fetchAll} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* NEW: Smart Order Tracking */}
                                {!isInvoicesView && (s.status === 'assigned' || s.status === 'in_transit' || s.status === 'pending') && (
                                    <div className="mb-4">
                                        <SmartOrderTracking shipment={s} />
                                    </div>
                                )}

                                {/* Tracking Preview / Action */}
                                {!isInvoicesView && (
                                    <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 text-center">
                                        <MapPin className="mx-auto text-blue-400 mb-2" size={32} />
                                        <h3 className="font-semibold text-slate-700">Live Tracking Available</h3>
                                        <p className="text-sm text-slate-500 mb-4">See real-time driver location and accurate ETA.</p>
                                        <button
                                            onClick={() => navigate(`/customer/track/${s.id}`)}
                                            className="bg-white border border-blue-200 text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-50 transition shadow-sm"
                                        >
                                            Open Live Map View
                                        </button>
                                    </div>
                                )}

                                {/* NEW: Customer Controls */}
                                {!isInvoicesView && (
                                    <div className="mt-4">
                                        <CustomerControls shipment={s} onUpdate={fetchAll} />
                                    </div>
                                )}
                            </div>

                            {/* Right: Timeline & Actions */}
                            <div className="md:w-1/3 border-l border-gray-100 md:pl-8 mt-6 md:mt-0">
                                {!isInvoicesView && (
                                    <>
                                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                            <FileText size={18} /> Actions & Docs
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2 mb-6">
                                            <button onClick={() => handleDownload('invoice', s.id)} className="flex items-center justify-center gap-2 p-2 bg-white border border-slate-200 rounded text-xs hover:bg-gray-50">
                                                <Download size={14} /> Invoice
                                            </button>
                                            <button onClick={() => handleDownload('pod', s.id)} disabled={s.status !== 'delivered'} className={`flex items-center justify-center gap-2 p-2 bg-white border border-slate-200 rounded text-xs ${s.status !== 'delivered' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                                                <Download size={14} /> POD
                                            </button>
                                        </div>
                                    </>
                                )}

                                <div className="mt-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-500">Invoice Amount</span>
                                        <span className="font-bold text-slate-800">${s.invoice_amount}</span>
                                    </div>
                                    {s.status === 'delivered' && s.payment_status === 'pending' && !s.payment_locked ? (
                                        <button
                                            onClick={() => handlePay(s.id, s.invoice_amount)}
                                            className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2"
                                        >
                                            <CreditCard size={16} /> Pay Now
                                        </button>
                                    ) : s.payment_status === 'paid' ? (
                                        <div className="w-full py-2 bg-green-50 text-green-700 text-center text-sm font-bold rounded-lg border border-green-200">
                                            INVOICE PAID
                                        </div>
                                    ) : (
                                        // Allow payment even if locked for demo purposes if it's pending
                                        s.payment_status === 'pending' ? (
                                            <button
                                                onClick={() => handlePay(s.id, s.invoice_amount)}
                                                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                                            >
                                                <CreditCard size={16} /> Pay Now
                                            </button>
                                        ) : (
                                            <button disabled className="w-full bg-gray-200 text-gray-400 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                                                Status: {s.payment_status}
                                            </button>
                                        )
                                    )}

                                    {/* NEW: Customer Issue Resolution */}
                                    <div className="w-full mt-3">
                                        <CustomerIssueResolution shipment={s} onReported={fetchAll} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {myShipments.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500">No shipments found on this account.</p>
                </div>
            )}

            {/* Issue Modal */}
            {showIssueModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Report Issue</h3>
                            <button onClick={() => setShowIssueModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <form onSubmit={handleReportIssue} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Issue Type</label>
                                <select
                                    className="w-full border rounded-lg p-2"
                                    value={issueData.type}
                                    onChange={e => setIssueData({ ...issueData, type: e.target.value })}
                                >
                                    <option>Delay</option>
                                    <option>Damage</option>
                                    <option>Lost Package</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    className="w-full border rounded-lg p-2 h-24"
                                    placeholder="Please describe the issue..."
                                    value={issueData.description}
                                    onChange={e => setIssueData({ ...issueData, description: e.target.value })}
                                    required
                                ></textarea>
                            </div>
                            <button className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition">
                                Submit Report
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Rating Modal */}
            {showRatingModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-center">
                        <div className="bg-slate-900 p-6 text-white">
                            <h3 className="font-bold text-xl">Rate Your Experience</h3>
                            <p className="text-slate-400 text-sm">Shipment #{myShipments.find(s => s.id === selectedShipmentId)?.tracking_number}</p>
                        </div>
                        <form onSubmit={handleSubmitRating} className="p-8 space-y-6">
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRatingData({ ...ratingData, rating: star })}
                                        className={`text-4xl transition transform hover:scale-110 ${star <= ratingData.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                            <div className="text-sm font-bold text-slate-600">
                                {ratingData.rating === 5 ? "Excellent!" : ratingData.rating >= 4 ? "Very Good" : ratingData.rating >= 3 ? "Good" : "Needs Improvement"}
                            </div>

                            <textarea
                                className="w-full border rounded-lg p-3 bg-gray-50 focus:bg-white transition"
                                placeholder="Share your feedback about the driver..."
                                rows="3"
                                value={ratingData.comment}
                                onChange={e => setRatingData({ ...ratingData, comment: e.target.value })}
                            ></textarea>

                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => setShowRatingModal(false)} className="py-3 rounded-lg text-slate-500 hover:bg-slate-50 font-medium">Cancel</button>
                                <button type="submit" className="bg-yellow-400 text-black py-3 rounded-lg font-bold hover:bg-yellow-500 shadow-md transition">Submit Feedback</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* NEW: Chatbot Component */}
            <Chatbot role="customer" />
        </DashboardLayout>
    );
};

export default CustomerDashboard;
