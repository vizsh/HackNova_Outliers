/**
 * Guided Customer Feedback Component
 * 
 * Structured feedback form after delivery completion with:
 * - Was delivery on time given circumstances?
 * - Driver professionalism
 * - Issues beyond driver's control
 * - Optional free-text feedback
 * 
 * Stores feedback with clear attribution (driver-related vs system-related).
 * No automatic penalties - all attribution is fair.
 */

import { useState } from 'react';
import axios from 'axios';
import { Star, CheckCircle, AlertCircle, X, MessageSquare } from 'lucide-react';

const GuidedFeedback = ({ shipment, onSubmitted }) => {
    const [showModal, setShowModal] = useState(false);
    const [feedback, setFeedback] = useState({
        on_time_given_circumstances: null,
        driver_professionalism: null,
        issues_beyond_driver_control: [],
        free_text_feedback: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!feedback.on_time_given_circumstances || !feedback.driver_professionalism) {
            alert('Please answer all required questions');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');

            await axios.post(
                `http://localhost:3000/api/customer/shipments/${shipment.id}/feedback-structured`,
                feedback,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSubmitted(true);
            if (onSubmitted) onSubmitted();
            
            // Auto-close after 2 seconds
            setTimeout(() => {
                setShowModal(false);
                setFeedback({
                    on_time_given_circumstances: null,
                    driver_professionalism: null,
                    issues_beyond_driver_control: [],
                    free_text_feedback: ''
                });
                setSubmitted(false);
            }, 2000);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    const issuesOptions = [
        'Weather conditions',
        'Traffic delays',
        'Route problems',
        'Package issues',
        'Address problems',
        'System issues'
    ];

    const toggleIssue = (issue) => {
        setFeedback({
            ...feedback,
            issues_beyond_driver_control: feedback.issues_beyond_driver_control.includes(issue)
                ? feedback.issues_beyond_driver_control.filter(i => i !== issue)
                : [...feedback.issues_beyond_driver_control, issue]
        });
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="text-xs bg-yellow-400 text-black px-3 py-1 rounded shadow-sm hover:bg-yellow-500 transition font-bold flex items-center gap-1"
            >
                <MessageSquare size={14} />
                Rate Service
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                            <div>
                                <h3 className="font-bold text-xl">Share Your Feedback</h3>
                                <p className="text-sm text-blue-100 mt-1">Shipment #{shipment.tracking_number}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200">
                                <X size={24} />
                            </button>
                        </div>

                        {submitted ? (
                            <div className="p-12 text-center">
                                <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h3>
                                <p className="text-slate-600">Your feedback helps us improve our service.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                                {/* Question 1: On-Time Given Circumstances */}
                                <div className="p-5 bg-blue-50 rounded-lg border border-blue-200">
                                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                                        1. Was delivery on time given the circumstances?
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { value: true, label: 'Yes', icon: CheckCircle },
                                            { value: false, label: 'No', icon: AlertCircle }
                                        ].map(({ value, label, icon: Icon }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setFeedback({ ...feedback, on_time_given_circumstances: value })}
                                                className={`p-4 rounded-lg border-2 transition ${
                                                    feedback.on_time_given_circumstances === value
                                                        ? 'border-blue-500 bg-blue-100'
                                                        : 'border-slate-200 bg-white hover:border-blue-300'
                                                }`}
                                            >
                                                <Icon className={`mx-auto mb-2 ${
                                                    feedback.on_time_given_circumstances === value ? 'text-blue-600' : 'text-slate-400'
                                                }`} size={32} />
                                                <div className={`font-medium ${
                                                    feedback.on_time_given_circumstances === value ? 'text-blue-800' : 'text-slate-600'
                                                }`}>
                                                    {label}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Question 2: Driver Professionalism */}
                                <div className="p-5 bg-green-50 rounded-lg border border-green-200">
                                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                                        2. How professional was the driver?
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <div className="flex justify-center gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setFeedback({ ...feedback, driver_professionalism: star })}
                                                className={`text-5xl transition transform hover:scale-110 ${
                                                    star <= (feedback.driver_professionalism || 0)
                                                        ? 'text-yellow-400'
                                                        : 'text-gray-300'
                                                }`}
                                            >
                                                <Star fill={star <= (feedback.driver_professionalism || 0) ? 'currentColor' : 'none'} />
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-center mt-2 text-sm text-slate-600">
                                        {feedback.driver_professionalism === 5 ? 'Excellent!' :
                                         feedback.driver_professionalism === 4 ? 'Very Good' :
                                         feedback.driver_professionalism === 3 ? 'Good' :
                                         feedback.driver_professionalism === 2 ? 'Fair' :
                                         feedback.driver_professionalism === 1 ? 'Needs Improvement' :
                                         'Select a rating'}
                                    </div>
                                </div>

                                {/* Question 3: Issues Beyond Driver Control */}
                                <div className="p-5 bg-orange-50 rounded-lg border border-orange-200">
                                    <label className="block text-sm font-semibold text-slate-800 mb-4">
                                        3. Were there any issues beyond the driver's control?
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {issuesOptions.map((issue) => (
                                            <button
                                                key={issue}
                                                type="button"
                                                onClick={() => toggleIssue(issue)}
                                                className={`p-3 rounded-lg border-2 text-sm transition ${
                                                    feedback.issues_beyond_driver_control.includes(issue)
                                                        ? 'border-orange-500 bg-orange-100 text-orange-800'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                                                }`}
                                            >
                                                {feedback.issues_beyond_driver_control.includes(issue) && (
                                                    <CheckCircle className="inline mr-2" size={16} />
                                                )}
                                                {issue}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-600 mt-3">
                                        <strong>Fair Attribution:</strong> Selecting these helps us understand issues that were 
                                        not the driver's fault. This feedback is used for system improvements, not driver penalties.
                                    </p>
                                </div>

                                {/* Free Text Feedback */}
                                <div className="p-5 bg-slate-50 rounded-lg border border-slate-200">
                                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                                        4. Additional Comments (Optional)
                                    </label>
                                    <textarea
                                        value={feedback.free_text_feedback}
                                        onChange={e => setFeedback({ ...feedback, free_text_feedback: e.target.value })}
                                        placeholder="Share any additional feedback about your delivery experience..."
                                        className="w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
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
                                        disabled={submitting || !feedback.on_time_given_circumstances || !feedback.driver_professionalism}
                                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Feedback'}
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

export default GuidedFeedback;
