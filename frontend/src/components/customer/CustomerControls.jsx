/**
 * Customer Controls Component
 * 
 * Allows customers to:
 * - Reschedule delivery
 * - Update delivery instructions
 * - Contact driver (masked number)
 * 
 * BOUNDARY: All actions create EVENTS, not direct mutations.
 * Events are queued for operator review. Core delivery logic remains unchanged.
 */

import { useState } from 'react';
import axios from 'axios';
import { Calendar, FileText, Phone, CheckCircle, X } from 'lucide-react';

const CustomerControls = ({ shipment, onUpdate }) => {
    const [showReschedule, setShowReschedule] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [rescheduleData, setRescheduleData] = useState({ date: '', time: '', reason: '' });
    const [instructions, setInstructions] = useState('');
    const [maskedNumber, setMaskedNumber] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleReschedule = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');
            const newDateTime = `${rescheduleData.date}T${rescheduleData.time}`;

            await axios.post(
                `http://localhost:3000/api/customer/shipments/${shipment.id}/reschedule`,
                {
                    new_preferred_date: newDateTime,
                    reason: rescheduleData.reason || 'Customer requested reschedule'
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMessage({
                type: 'success',
                text: 'Reschedule request submitted! Our team will review and confirm within 24 hours.'
            });
            setShowReschedule(false);
            setRescheduleData({ date: '', time: '', reason: '' });
            if (onUpdate) onUpdate();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to submit reschedule request'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateInstructions = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');

            await axios.post(
                `http://localhost:3000/api/customer/shipments/${shipment.id}/instructions`,
                { instructions },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMessage({
                type: 'success',
                text: 'Delivery instructions updated successfully! Driver will be notified.'
            });
            setShowInstructions(false);
            setInstructions('');
            if (onUpdate) onUpdate();
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Failed to update instructions'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleContactDriver = async () => {
        setLoading(true);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');

            const response = await axios.post(
                `http://localhost:3000/api/customer/shipments/${shipment.id}/contact-driver`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMaskedNumber(response.data.masked_number);
            setMessage({
                type: 'success',
                text: response.data.message || 'Use this number to contact your driver securely.'
            });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || 'Driver not assigned yet or contact unavailable'
            });
        } finally {
            setLoading(false);
        }
    };

    // Only show controls for active shipments
    if (!shipment || (shipment.status !== 'assigned' && shipment.status !== 'in_transit' && shipment.status !== 'pending')) {
        return null;
    }

    return (
        <div className="space-y-3">
            {/* Message Display */}
            {message && (
                <div className={`p-3 rounded-lg border flex items-center justify-between ${
                    message.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-800' 
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    <span className="text-sm">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-2">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Reschedule */}
                <button
                    onClick={() => setShowReschedule(true)}
                    disabled={loading}
                    className="p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition flex flex-col items-center gap-2 text-center disabled:opacity-50"
                >
                    <Calendar className="text-blue-600" size={24} />
                    <span className="text-sm font-semibold text-slate-800">Reschedule</span>
                    <span className="text-xs text-slate-500">Request new date/time</span>
                </button>

                {/* Update Instructions */}
                <button
                    onClick={() => setShowInstructions(true)}
                    disabled={loading}
                    className="p-4 bg-white border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition flex flex-col items-center gap-2 text-center disabled:opacity-50"
                >
                    <FileText className="text-green-600" size={24} />
                    <span className="text-sm font-semibold text-slate-800">Instructions</span>
                    <span className="text-xs text-slate-500">Update delivery notes</span>
                </button>

                {/* Contact Driver */}
                <button
                    onClick={handleContactDriver}
                    disabled={loading || !shipment.driver_id}
                    className="p-4 bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition flex flex-col items-center gap-2 text-center disabled:opacity-50"
                >
                    <Phone className="text-purple-600" size={24} />
                    <span className="text-sm font-semibold text-slate-800">Contact Driver</span>
                    <span className="text-xs text-slate-500">Call via masked number</span>
                </button>
            </div>

            {/* Masked Number Display */}
            {maskedNumber && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-sm font-semibold text-purple-800 mb-2">Driver Contact Number</div>
                    <div className="text-2xl font-bold text-purple-900 mb-2">{maskedNumber}</div>
                    <p className="text-xs text-purple-700">
                        Use this number to contact your driver. Calls are routed through our secure system.
                    </p>
                    <button
                        onClick={() => window.open(`tel:${maskedNumber.replace(/\s/g, '')}`)}
                        className="mt-3 w-full bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                    >
                        <Phone size={16} className="inline mr-2" />
                        Call Driver
                    </button>
                </div>
            )}

            {/* Reschedule Modal */}
            {showReschedule && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Reschedule Delivery</h3>
                            <button onClick={() => setShowReschedule(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleReschedule} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    New Preferred Date
                                </label>
                                <input
                                    type="date"
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                    value={rescheduleData.date}
                                    onChange={e => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                                    className="w-full border rounded-lg p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Preferred Time
                                </label>
                                <input
                                    type="time"
                                    required
                                    value={rescheduleData.time}
                                    onChange={e => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                                    className="w-full border rounded-lg p-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Reason (Optional)
                                </label>
                                <textarea
                                    value={rescheduleData.reason}
                                    onChange={e => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                                    placeholder="Please let us know why you need to reschedule..."
                                    className="w-full border rounded-lg p-2 h-24"
                                />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                                <strong>Note:</strong> This is a request. Our team will review and confirm within 24 hours. 
                                Your delivery will continue as scheduled until confirmed.
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowReschedule(false)}
                                    className="flex-1 bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-medium hover:bg-slate-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {loading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Instructions Modal */}
            {showInstructions && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Update Delivery Instructions</h3>
                            <button onClick={() => setShowInstructions(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateInstructions} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Delivery Instructions
                                </label>
                                <textarea
                                    required
                                    value={instructions}
                                    onChange={e => setInstructions(e.target.value)}
                                    placeholder="e.g., Leave package at front door, Ring doorbell, Call upon arrival..."
                                    className="w-full border rounded-lg p-2 h-32"
                                />
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
                                <strong>Note:</strong> Instructions will be added to your delivery. 
                                The driver will be notified of these updates. This does not affect your delivery schedule.
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowInstructions(false)}
                                    className="flex-1 bg-slate-200 text-slate-800 px-4 py-2 rounded-lg font-medium hover:bg-slate-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                                >
                                    {loading ? 'Updating...' : 'Update Instructions'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerControls;
