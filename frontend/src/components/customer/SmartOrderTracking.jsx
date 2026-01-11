/**
 * Smart Order Tracking Component (Customer View)
 * 
 * Provides customer-friendly order tracking with:
 * - Live location (if available)
 * - ETA with confidence band (e.g., "3:10-3:25 PM")
 * - Human-readable status explanations
 * - Delay reasons if any
 * 
 * BOUNDARY: This is read-only customer view.
 * Does NOT expose internal KPIs, probabilities, or driver scores.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, MapPin, AlertCircle, CheckCircle, Navigation } from 'lucide-react';
import socket from '../../utils/socket';

const SmartOrderTracking = ({ shipment }) => {
    const [etaInfo, setEtaInfo] = useState(null);
    const [reliability, setReliability] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!shipment) return;

        const fetchTrackingInfo = async () => {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            try {
                // Fetch customer-friendly ETA
                const etaRes = await axios.get(
                    `http://localhost:3000/api/customer/shipments/${shipment.id}/eta`,
                    { headers }
                ).catch(() => null);

                // Fetch delivery reliability
                const relRes = await axios.get(
                    `http://localhost:3000/api/customer/shipments/${shipment.id}/reliability`,
                    { headers }
                ).catch(() => null);

                if (etaRes?.data) setEtaInfo(etaRes.data);
                if (relRes?.data) setReliability(relRes.data);
            } catch (error) {
                console.error('Error fetching tracking info:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrackingInfo();

        // Set up interval to refresh ETA (every 5 minutes)
        const interval = setInterval(fetchTrackingInfo, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [shipment]);

    // Listen for driver location updates
    useEffect(() => {
        if (!shipment || !shipment.driver_id) return;

        const handleDriverLocation = (data) => {
            if (String(data.driverId) === String(shipment.driver_id)) {
                setDriverLocation({
                    lat: data.lat,
                    lng: data.lng,
                    timestamp: data.timestamp
                });
            }
        };

        socket.on('driver:location', handleDriverLocation);

        return () => {
            socket.off('driver:location', handleDriverLocation);
        };
    }, [shipment]);

    if (loading) {
        return (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            </div>
        );
    }

    if (!etaInfo) {
        return (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600">Tracking information will be available once delivery is assigned.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ETA with Confidence Band */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-full">
                            <Clock className="text-white" size={20} />
                        </div>
                        <div>
                            <div className="text-xs text-blue-700 uppercase tracking-wide font-semibold mb-1">
                                Estimated Arrival
                            </div>
                            <div className="text-2xl font-bold text-blue-900">
                                {etaInfo.eta_range || etaInfo.estimated_arrival || 'Calculating...'}
                            </div>
                            {etaInfo.eta_range && (
                                <div className="text-xs text-blue-600 mt-1">
                                    Confidence: {etaInfo.confidence_level}
                                </div>
                            )}
                        </div>
                    </div>
                    {driverLocation && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-blue-200">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium text-blue-700">Live</span>
                        </div>
                    )}
                </div>

                {/* Status Explanation */}
                {etaInfo.status_explanation && (
                    <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-slate-700">{etaInfo.status_explanation}</p>
                        </div>
                    </div>
                )}

                {/* Delay Risk Indicator */}
                {etaInfo.delay_risk_band && etaInfo.delay_risk_band !== 'low' && (
                    <div className={`mt-3 p-3 rounded-lg border ${
                        etaInfo.delay_risk_band === 'high' 
                            ? 'bg-red-50 border-red-200' 
                            : 'bg-yellow-50 border-yellow-200'
                    }`}>
                        <div className="flex items-center gap-2">
                            <AlertCircle 
                                size={16} 
                                className={etaInfo.delay_risk_band === 'high' ? 'text-red-600' : 'text-yellow-600'} 
                            />
                            <span className={`text-xs font-medium ${
                                etaInfo.delay_risk_band === 'high' ? 'text-red-700' : 'text-yellow-700'
                            }`}>
                                {etaInfo.delay_risk_band === 'high' 
                                    ? 'Possible delays expected' 
                                    : 'Minor delays possible'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Delivery Reliability Indicator */}
            {reliability && (
                <div className={`p-4 rounded-xl border-2 ${
                    reliability.reliability === 'HIGH' 
                        ? 'bg-green-50 border-green-300' 
                        : reliability.reliability === 'LOW'
                        ? 'bg-red-50 border-red-300'
                        : 'bg-yellow-50 border-yellow-300'
                }`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {reliability.reliability === 'HIGH' ? (
                                <CheckCircle className="text-green-600" size={20} />
                            ) : (
                                <AlertCircle className={reliability.reliability === 'LOW' ? 'text-red-600' : 'text-yellow-600'} size={20} />
                            )}
                            <span className="text-sm font-semibold text-slate-700">Delivery Reliability</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            reliability.reliability === 'HIGH'
                                ? 'bg-green-100 text-green-700'
                                : reliability.reliability === 'LOW'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                        }`}>
                            {reliability.reliability}
                        </span>
                    </div>
                    {reliability.explanation && (
                        <p className="text-xs text-slate-600 mt-2">{reliability.explanation}</p>
                    )}
                </div>
            )}

            {/* Live Location Status */}
            {driverLocation && (
                <div className="p-4 bg-white rounded-lg border border-green-200 bg-green-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500 rounded-full">
                            <Navigation className="text-white" size={16} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-green-800">Driver On Route</div>
                            <div className="text-xs text-green-600">Real-time location tracking active</div>
                        </div>
                        <div className="text-xs text-green-700">
                            {driverLocation.timestamp 
                                ? new Date(driverLocation.timestamp).toLocaleTimeString()
                                : 'Just now'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartOrderTracking;
