/**
 * Customer Issue Resolution Component
 * 
 * Self-service issue reporting with categories:
 * - Delivery delayed
 * - Address issue
 * - Package concern
 * - Driver communication issue
 * 
 * BOUNDARY: Issues create support events.
 * They do NOT block order completion.
 * Clear customer expectations are set.
 */

import { useState } from 'react';
import axios from 'axios';
import { AlertCircle, X, CheckCircle, Clock, MapPin, Package, MessageSquare } from 'lucide-react';

const CustomerIssueResolution = ({ shipment, onReported }) => {
    const [showModal, setShowModal] = useState(false);
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const issueCategories = [
        {
            id: 'delivery_delayed',
            label: 'Delivery Delayed',
            icon: Clock,
            description: 'My delivery is taking longer than expected',
            color: 'orange'
        },
        {
            id: 'address_issue',
            label: 'Address Issue',
            icon: MapPin,
            description: 'I need to update or correct my delivery address',
            color: 'blue'
        },
        {
            id: 'package_concern',
            label: 'Package Concern',
            icon: Package,
            description: 'I have concerns about my package condition',
            color: 'red'
        },
        {
            id: 'driver_communication_issue',
            label: 'Driver Communication',
            icon: MessageSquare,
            description: 'I need to communicate with the driver',
            color: 'purple'
        }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!category || !description.trim()) {
            alert('Please select a category and provide a description');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');

            const response = await axios.post(
                `http://localhost:3000/api/customer/shipments/${shipment.id}/issues-categorized`,
                { category, description },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSubmitted(true);
            if (onReported) onReported();

            // Auto-close after 3 seconds
            setTimeout(() => {
                setShowModal(false);
                setCategory('');
                setDescription('');
                setSubmitted(false);
            }, 3000);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to report issue');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedCategory = issueCategories.find(c => c.id === category);

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="text-red-500 text-xs hover:underline flex items-center gap-1"
            >
                <AlertCircle size={12} />
                Report an Issue
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Report an Issue</h3>
                                <p className="text-sm text-slate-600 mt-1">Shipment #{shipment.tracking_number}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        {submitted ? (
                            <div className="p-12 text-center">
                                <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Issue Reported</h3>
                                <p className="text-slate-600 mb-4">Our support team will contact you within 24 hours.</p>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                                    <strong>Note:</strong> This issue does not affect your delivery completion. 
                                    We'll work to resolve it while your delivery continues.
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {/* Category Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                                        Select Issue Category
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {issueCategories.map((cat) => {
                                            const Icon = cat.icon;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setCategory(cat.id)}
                                                    className={`p-4 rounded-lg border-2 transition text-left ${
                                                        category === cat.id
                                                            ? `border-${cat.color}-500 bg-${cat.color}-50`
                                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <Icon 
                                                            className={`mt-1 ${
                                                                category === cat.id ? `text-${cat.color}-600` : 'text-slate-400'
                                                            }`} 
                                                            size={24} 
                                                        />
                                                        <div>
                                                            <div className={`font-semibold mb-1 ${
                                                                category === cat.id ? `text-${cat.color}-800` : 'text-slate-700'
                                                            }`}>
                                                                {cat.label}
                                                            </div>
                                                            <div className="text-xs text-slate-500">{cat.description}</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Description */}
                                {category && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800 mb-2">
                                            Describe the Issue
                                            <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <textarea
                                            required
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder={`Please provide details about the ${selectedCategory?.label.toLowerCase()}...`}
                                            className="w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        />
                                    </div>
                                )}

                                {/* Customer Expectations */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="text-blue-600 mt-0.5" size={20} />
                                        <div className="text-sm text-blue-800">
                                            <strong>What to Expect:</strong>
                                            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                                                <li>Our support team will review your issue within 24 hours</li>
                                                <li>You'll receive a response via email or phone</li>
                                                <li>This issue does NOT block your delivery completion</li>
                                                <li>We'll work to resolve it while your delivery continues</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 bg-slate-200 text-slate-800 px-4 py-3 rounded-lg font-medium hover:bg-slate-300 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || !category || !description.trim()}
                                        className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Submitting...' : 'Report Issue'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default CustomerIssueResolution;
