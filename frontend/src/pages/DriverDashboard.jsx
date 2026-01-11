import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, StatusBadge } from '../components/common/UI';
import { MapPin, Navigation, Package, Check, Camera, ShieldCheck, Clock, Zap, CheckCircle } from 'lucide-react';
import io from 'socket.io-client';
import MapComponent from '../components/MapComponent';
// NEW: Chatbot component
import Chatbot from '../components/chatbot/Chatbot';

// Connect to socket
const socket = io('http://localhost:3000');

// Fallback Data to ensure User always sees something


const DriverDashboard = () => {
    const [activeJobs, setActiveJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [history, setHistory] = useState([]);
    const [locationStats, setLocationStats] = useState({ lat: null, lng: null });

    // OTP State
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [podPhoto, setPodPhoto] = useState(null);
    const [photoLatitude, setPhotoLatitude] = useState(null);
    const [photoLongitude, setPhotoLongitude] = useState(null);
    const [photoTimestamp, setPhotoTimestamp] = useState(null);
    const [photoError, setPhotoError] = useState('');
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);

    // AI Route State
    const [routeAnalysis, setRouteAnalysis] = useState(null);

    const location = useLocation();
    const isHistoryView = location.pathname.includes('/history');

    const [stats, setStats] = useState(null);
    const [currentTab, setCurrentTab] = useState('active'); // active, history, performance
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileData, setProfileData] = useState({
        name: '',
        age: '',
        experience: '',
        route_familiarity: '',
        skill_level: '',
        vehicle_handling_capacity: ''
    });

    const fetchDriverStats = async () => {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        try {
            const statsRes = await axios.get(`http://localhost:3000/api/data/drivers/${userId}/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = statsRes.data;
            setStats(data);
            // Initialize profile data
            setProfileData({
                name: data.name || '',
                age: data.age || '',
                experience: data.experience || '',
                route_familiarity: data.route_familiarity || '3',
                skill_level: data.skill_level || '5',
                vehicle_handling_capacity: data.vehicle_handling_capacity || '1500'
            });
        } catch (e) {
            console.error('Fetch stats failed', e);
        }
    };

    useEffect(() => {
        const fetchJobs = async () => {
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            try {
                // Fetch Assigned Shipments
                const res = await axios.get('http://localhost:3000/api/data/assigned-shipments', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const active = res.data.filter(s => s.status === 'assigned' || s.status === 'in_transit');
                const done = res.data.filter(s => s.status === 'delivered');

                if (active.length > 0) setActiveJobs(active);
                else setActiveJobs([]);

                setHistory(done);

                // Fetch Performance Stats
                await fetchDriverStats();

            } catch (e) {
                console.error('Fetch failed', e);
                setActiveJobs([]);
            }
        };

        fetchJobs();

        // Listen for Operator Requests
        socket.on('request:location', (data) => {
            if (data.driverId == localStorage.getItem('userId')) {
                setShowLocationPermissionModal(true);
            }
        });

        // Start GPS Simulation
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setLocationStats({ lat: latitude, lng: longitude });
                socket.emit('location:update', {
                    driverId: localStorage.getItem('userId'),
                    lat: latitude,
                    lng: longitude,
                    timestamp: Date.now()
                });
            },
            (err) => console.error(err),
            { enableHighAccuracy: true }
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
            socket.off('request:location');
        };
    }, []);

    const handleAllowLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const driverId = localStorage.getItem('userId');
                    
                    // Update local state
                    setLocationStats({ lat: latitude, lng: longitude });
                    
                    // Send location to server via socket
                    socket.emit('location:update', {
                        driverId: driverId,
                        lat: latitude,
                        lng: longitude
                    });
                    
                    alert("Location Shared with Operator");
                    setShowLocationPermissionModal(false);
                },
                (err) => {
                    console.error('Geolocation error:', err);
                    alert('Unable to access location. Please enable location permissions in your browser settings.');
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            alert('Geolocation is not supported by this browser.');
            setShowLocationPermissionModal(false);
        }
    };

    const handleDenyLocation = () => {
        setShowLocationPermissionModal(false);
        // Optionally notify operator that location was denied
        socket.emit('location:denied', { driverId: localStorage.getItem('userId') });
    };

    // Capture photo with GPS metadata
    const handleCapturePhoto = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Use back camera on mobile
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Get GPS location
            if (!navigator.geolocation) {
                setPhotoError('GPS is required for proof of delivery photo. Please enable location services.');
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const timestamp = new Date().toISOString();
                    
                    // Convert file to base64 URL for preview
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        setPodPhoto(event.target.result);
                        setPhotoLatitude(lat);
                        setPhotoLongitude(lng);
                        setPhotoTimestamp(timestamp);
                        setPhotoError('');
                    };
                    reader.readAsDataURL(file);
                },
                (err) => {
                    setPhotoError('Failed to get GPS location. Please enable location services and try again.');
                    console.error('Geolocation error:', err);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        };
        
        input.click();
    };

    const handleCompleteDelivery = async () => {
        const token = localStorage.getItem('token');
        if (!selectedJob) return;
        
        // Validate OTP
        if (!otpCode || otpCode.length !== 6) {
            alert('Please enter a valid 6-digit OTP code.');
            return;
        }
        
        // Validate photo with GPS
        if (!podPhoto || !photoLatitude || !photoLongitude) {
            setPhotoError('Photo with GPS location is required. Please capture a photo.');
            return;
        }
        
        try {
            // Upload photo to server (in production, upload to cloud storage first)
            // For now, we'll send the base64 data URL
            const photoData = {
                url: podPhoto,
                latitude: photoLatitude,
                longitude: photoLongitude,
                timestamp: photoTimestamp || new Date().toISOString()
            };
            
            await axios.post(`http://localhost:3000/api/data/shipments/${selectedJob.id}/complete`, {
                otp: otpCode,
                photo_url: photoData.url,
                photo_latitude: photoData.latitude,
                photo_longitude: photoData.longitude,
                photo_timestamp: photoData.timestamp
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            alert('Delivery Verified & Completed!');
            setShowOtpModal(false);
            setOtpCode('');
            setPodPhoto(null);
            setPhotoLatitude(null);
            setPhotoLongitude(null);
            setPhotoTimestamp(null);
            setPhotoError('');
            window.location.reload(); // Simple refresh to update state
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Verification failed';
            const step = err.response?.data?.step || '';
            
            if (step === 'otp_verification') {
                alert(`OTP Verification Failed: ${errorMsg}`);
                if (err.response?.data?.locked) {
                    alert('OTP verification is locked due to too many failed attempts. Please contact support.');
                }
            } else if (step === 'photo_upload' || step === 'photo_validation') {
                setPhotoError(errorMsg);
                alert(`Photo Validation Failed: ${errorMsg}`);
            } else {
                alert(`Verification Failed: ${errorMsg}`);
            }
        }
    };

    const handleNavigate = (destLat, destLng, originLat, originLng) => {
        if (!destLat || !destLng) return alert('Coordinates missing for this job.');

        // If origin is provided, use it. Otherwise google maps defaults to current location.
        // User explicitly asked for pickup location to be origin.
        let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
        if (originLat && originLng) {
            url += `&origin=${originLat},${originLng}`;
        }

        window.open(url, '_blank');
    };

    const handleAnalyzeRoute = async (shipment) => {
        if (!shipment) return;
        setRouteAnalysis(null); // Reset
        try {
            // Mock Cities/Coords if missing (Prototype Fix)
            const payload = {
                origin_lat: shipment.pickup_lat || 19.0760,
                origin_lng: shipment.pickup_lng || 72.8777,
                dest_lat: shipment.drop_lat || 18.5204,
                dest_lng: shipment.drop_lng || 73.8567,
                origin_city: shipment.origin || "Mumbai",
                dest_city: shipment.destination || "Pune",
                // NEW: Enhanced Context for AI
                freight_type: shipment.freight_type || "Standard",
                weight: shipment.weight ? parseFloat(shipment.weight) : 100, // Default 100kg
                deadline: shipment.deadline || null
            };

            const res = await axios.post('http://localhost:8000/analyze-route', payload);
            setRouteAnalysis(res.data);
        } catch (err) {
            alert('AI Analysis Failed: Check connections');
            console.error(err);
        }
    };

    return (
        <DashboardLayout role="driver">
            <div className="flex justify-between items-center mb-6 px-2 border-l-4 border-green-500">
                <h1 className="text-2xl font-bold text-slate-800">Driver Console</h1>
                <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setCurrentTab('active')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${currentTab === 'active' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >Active</button>
                    <button
                        onClick={() => setCurrentTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${currentTab === 'history' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >History</button>
                    <button
                        onClick={() => setCurrentTab('profile')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${currentTab === 'profile' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >My Profile</button>
                    <button
                        onClick={() => setCurrentTab('performance')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${currentTab === 'performance' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >Performance</button>
                </div>
            </div>

            {/* Main Content */}
            {/* Main Content */}
            {currentTab === 'performance' && stats ? (
                <div className="space-y-6">
                    {/* Hero Stats */}
                    <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <ShieldCheck size={120} />
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                            <div className="relative">
                                <svg className="w-32 h-32 transform -rotate-90">
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-700" />
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-green-500" strokeDasharray={`${stats.skill_index * 3.77} 377`} />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-3xl font-bold">{stats.skill_index}</span>
                                    <span className="text-xs text-slate-400">INDEX</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-green-400 font-bold uppercase tracking-wider mb-1">Driver Level</div>
                                <h2 className="text-4xl font-bold mb-2">{stats.level}</h2>
                                <p className="text-slate-400 max-w-sm">Keep up the high safety standards and on-time delivery rate to maintain Elite status.</p>
                            </div>
                        </div>
                    </div>

                    {/* KPI Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
                            <div className="text-3xl font-bold text-slate-800 mb-1">{stats.on_time_rate}%</div>
                            <div className="text-xs text-gray-500 uppercase font-bold">On-Time Rate</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
                            <div className="text-3xl font-bold text-slate-800 mb-1">{stats.avg_rating} <span className="text-sm text-yellow-500">★</span></div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Avg Rating</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
                            <div className="text-3xl font-bold text-slate-800 mb-1">{stats.pod_compliance}%</div>
                            <div className="text-xs text-gray-500 uppercase font-bold">POD Compliance</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-center">
                            <div className="text-3xl font-bold text-slate-800 mb-1">{stats.total_deliveries}</div>
                            <div className="text-xs text-gray-500 uppercase font-bold">Total Missions</div>
                        </div>
                    </div>

                    {/* Feedback Feed */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="font-bold text-slate-800">Recent Customer Feedback</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {stats.feedback && stats.feedback.length > 0 ? stats.feedback.map(f => (
                                <div key={f.id} className="p-6 hover:bg-gray-50 transition">
                                    <div className="flex justify-between mb-2">
                                        <div className="flex text-yellow-500 text-sm">
                                            {'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}
                                        </div>
                                        <span className="text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-slate-600 italic">"{f.comment}"</p>
                                </div>
                            )) : (
                                <div className="p-8 text-center text-gray-400">No feedback yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : currentTab === 'active' && activeJobs.length > 0 ? (
                <div className="space-y-6">
                    {activeJobs.map(job => (
                        <Card key={job.id} className="border-t-4 border-t-blue-500 shadow-lg relative">
                            {/* Mission Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Active Mission</span>
                                    <h2 className="text-3xl font-bold text-slate-900 mt-1">{job.tracking_number}</h2>
                                    <p className="text-slate-500">Standard Delivery • {job.id * 5 + 10} Items</p>
                                </div>
                                <StatusBadge status="IN_PROGRESS" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className="w-4 h-4 rounded-full bg-blue-500 ring-4 ring-blue-100"></div>
                                            <div className="w-1 h-full bg-gray-200 my-1"></div>
                                            <div className="w-4 h-4 rounded-full bg-slate-900"></div>
                                        </div>
                                        <div className="flex-1 space-y-8 py-1">
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase">Pickup</label>
                                                <p className="font-medium text-slate-800 text-lg">{job.origin}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase">Dropoff</label>
                                                <p className="font-medium text-slate-800 text-lg">{job.destination}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => handleNavigate(job.drop_lat, job.drop_lng, job.pickup_lat, job.pickup_lng)}
                                            className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 rounded-xl font-medium transition"
                                        >
                                            <Navigation size={20} /> Navigate
                                        </button>
                                        <button
                                            onClick={() => { setSelectedJob(job); setShowDetailsModal(true); }}
                                            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium transition"
                                        >
                                            <Package size={20} /> Details
                                        </button>
                                    </div>
                                </div>

                                {/* Map View */}
                                <div className="h-64 rounded-xl overflow-hidden relative shadow-inner border border-gray-200 z-0">
                                    <MapComponent
                                        shipments={[job]}
                                        routeGeometry={routeAnalysis?.geometry}
                                    />
                                </div>
                            </div>


                            {/* Action Bar */}
                            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-4">
                                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Clock size={16} />
                                        <span>ETA: {job.eta || 'Calculating...'}</span>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <button
                                            onClick={() => handleAnalyzeRoute(job)}
                                            className="flex-1 md:flex-none bg-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 transition flex items-center justify-center gap-2"
                                        >
                                            <Zap size={20} /> Smart Route
                                        </button>
                                        <button
                                            onClick={() => { setSelectedJob(job); setShowOtpModal(true); }}
                                            className="flex-1 md:flex-none bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition flex items-center justify-center gap-2"
                                        >
                                            <Check size={20} /> Complete
                                        </button>
                                    </div>
                                </div>

                                {/* AI ANALYSIS RESULT */}
                                {routeAnalysis && (
                                    <div className="mt-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-fade-in-up">

                                        {/* HEADER */}
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-xl flex items-center gap-2">
                                                    <Zap size={24} className="text-purple-600" /> AI Optimization Report
                                                </h4>
                                                <p className="text-slate-500 text-sm mt-1">Real-time analysis of route conditions and risks.</p>
                                            </div>
                                            <div className={`px-4 py-2 rounded-xl text-center ${routeAnalysis.risk_level === 'SAFE' ? 'bg-green-100 text-green-800' :
                                                routeAnalysis.risk_level === 'CAUTION' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                <div className="text-xs font-bold uppercase tracking-wider">Risk Score</div>
                                                <div className="text-3xl font-black">{routeAnalysis.risk_score}<span className="text-lg opacity-50">/100</span></div>
                                            </div>
                                        </div>

                                        {/* ETA & DISTANCE CARD */}
                                        {routeAnalysis.eta && (
                                            <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Estimated Time</div>
                                                        <div className="text-3xl font-black text-blue-900">{routeAnalysis.eta.formatted_eta}</div>
                                                        <div className="text-sm text-blue-700 mt-1">{routeAnalysis.eta.time_hours} hours</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Distance</div>
                                                        <div className="text-3xl font-black text-indigo-900">{routeAnalysis.eta.distance_km} <span className="text-lg">km</span></div>
                                                        <div className="text-sm text-indigo-700 mt-1">{routeAnalysis.eta.distance_miles} miles</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                            {/* LEFT COL: BREAKDOWN & WEATHER */}
                                            <div className="space-y-6">
                                                {/* SCORE CHART */}
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-700 uppercase mb-3">Safety Score Composition</h5>
                                                    <div className="space-y-3">
                                                        {routeAnalysis.score_breakdown && Object.entries(routeAnalysis.score_breakdown).map(([key, val]) => (
                                                            <div key={key}>
                                                                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                                                    <span>{key} Impact</span>
                                                                    <span>{val > 0 && key !== 'Base' ? `-${val}` : val}</span>
                                                                </div>
                                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${key === 'Base' ? 'bg-green-500' : 'bg-red-500'}`}
                                                                        style={{ width: `${Math.min(val, 100)}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* WEATHER CARD */}
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                                            <span className="text-2xl">🌤</span>
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800">{routeAnalysis.weather.desc}</div>
                                                            <div className="text-xs text-slate-500">Live Forecast</div>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-slate-600 leading-snug">
                                                        {routeAnalysis.weather.impact}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* RIGHT COL: RECOMMENDATION & ALERTS */}
                                            <div className="space-y-6">

                                                {/* RECOMMENDATION */}
                                                {routeAnalysis.recommendation && (
                                                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border border-blue-100 relative overflow-hidden">
                                                        <div className="relative z-10">
                                                            <div className="text-xs font-bold text-blue-600 uppercase mb-1">AI Recommendation</div>
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <span className="text-4xl">{routeAnalysis.recommendation.mode === 'Air Freight' ? '✈️' : routeAnalysis.recommendation.mode === 'Rail' ? '🚆' : '🚛'}</span>
                                                                <div className="text-2xl font-bold text-slate-800">{routeAnalysis.recommendation.mode}</div>
                                                            </div>
                                                            <p className="text-sm text-slate-700 font-medium">
                                                                {routeAnalysis.recommendation.reason}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ALERTS / NEWS */}
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-700 uppercase mb-3 text-red-600 flex items-center gap-2">
                                                        ⚠ Route Alerts & News
                                                    </h5>
                                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                                        {routeAnalysis.alerts && routeAnalysis.alerts.length > 0 ? routeAnalysis.alerts.map((alert, idx) => (
                                                            <div key={idx} className="bg-white p-3 rounded-lg border-l-4 border-red-500 shadow-sm text-sm text-slate-700">
                                                                {alert}
                                                            </div>
                                                        )) : (
                                                            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-2">
                                                                <CheckCircle size={16} /> No critical disruptions found.
                                                            </div>
                                                        )}
                                                        
                                                        {/* Relevant News Articles */}
                                                        {routeAnalysis.news_articles && routeAnalysis.news_articles.length > 0 && (
                                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Traffic & Incident News</div>
                                                                {routeAnalysis.news_articles.map((article, idx) => (
                                                                    <div key={idx} className="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-500 shadow-sm mb-2">
                                                                        <div className="font-semibold text-amber-900 text-sm mb-1">{article.title}</div>
                                                                        {article.description && (
                                                                            <div className="text-xs text-amber-700">{article.description.substring(0, 150)}...</div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            ) : currentTab === 'active' && activeJobs.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                    <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check size={40} className="text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">You're All Caught Up!</h2>
                    <p className="text-slate-500">No active jobs assigned to you at the moment.</p>
                </div>
            ) : currentTab === 'history' ? (
                <div className="space-y-4">
                    {history.map(job => (
                        <div key={job.id} className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800">{job.tracking_number}</h3>
                                <div className="text-sm text-gray-500">{job.origin} &rarr; {job.destination}</div>
                            </div>
                            <div className="text-right">
                                <StatusBadge status="DELIVERED" />
                                <div className="text-xs text-gray-400 mt-1">{new Date(job.created_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-gray-500 px-4">No job history found.</p>}
                </div>
            ) : currentTab === 'profile' ? (
                <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden mt-8">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-8 text-center text-white">
                        <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-full mx-auto flex items-center justify-center text-4xl font-bold border-4 border-white/30 mb-4">
                            {profileData?.name ? profileData.name[0] : stats?.name ? stats.name[0] : 'D'}
                        </div>
                        <h2 className="text-2xl font-bold">{profileData?.name || stats?.name || 'Driver Profile'}</h2>
                        <div className="text-blue-100 mt-1">{stats?.level || 'Standard'} Member</div>
                    </div>
                    <div className="p-8">
                        {isEditingProfile ? (
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const token = localStorage.getItem('token');
                                const userId = localStorage.getItem('userId');
                                try {
                                    await axios.put(`http://localhost:3000/api/data/drivers/${userId}/profile`, profileData, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                    alert('Profile updated successfully!');
                                    setIsEditingProfile(false);
                                    await fetchDriverStats();
                                } catch (err) {
                                    alert('Failed to update profile: ' + (err.response?.data?.error || err.message));
                                }
                            }} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Name</label>
                                        <input
                                            type="text"
                                            className="w-full border p-3 rounded-xl text-slate-800 font-medium"
                                            value={profileData.name}
                                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Age</label>
                                        <input
                                            type="number"
                                            className="w-full border p-3 rounded-xl text-slate-800 font-medium"
                                            value={profileData.age}
                                            onChange={(e) => setProfileData({ ...profileData, age: e.target.value })}
                                            min="18"
                                            max="70"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Experience</label>
                                    <input
                                        type="text"
                                        className="w-full border p-3 rounded-xl text-slate-800 font-medium"
                                        value={profileData.experience}
                                        onChange={(e) => setProfileData({ ...profileData, experience: e.target.value })}
                                        placeholder="e.g., 5 Years"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Route Familiarity (1-5)
                                        <span className="text-slate-400 normal-case ml-2">(Higher = Better knowledge of routes)</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        className="w-full"
                                        value={profileData.route_familiarity}
                                        onChange={(e) => setProfileData({ ...profileData, route_familiarity: e.target.value })}
                                    />
                                    <div className="text-center text-lg font-bold text-blue-600 mt-1">{profileData.route_familiarity}/5</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Skill Level (1-10)
                                        <span className="text-slate-400 normal-case ml-2">(Driving proficiency)</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        className="w-full"
                                        value={profileData.skill_level}
                                        onChange={(e) => setProfileData({ ...profileData, skill_level: e.target.value })}
                                    />
                                    <div className="text-center text-lg font-bold text-green-600 mt-1">{profileData.skill_level}/10</div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Vehicle Handling Capacity (kg)
                                        <span className="text-slate-400 normal-case ml-2">(Maximum weight you can handle)</span>
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full border p-3 rounded-xl text-slate-800 font-medium"
                                        value={profileData.vehicle_handling_capacity}
                                        onChange={(e) => setProfileData({ ...profileData, vehicle_handling_capacity: e.target.value })}
                                        min="500"
                                        max="10000"
                                        step="100"
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditingProfile(false);
                                            // Reset to original values
                                            fetchDriverStats();
                                        }}
                                        className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-300 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                                        <div>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Experience</div>
                                            <div className="font-bold text-slate-800 text-lg">{stats?.experience || profileData.experience || 'N/A'}</div>
                                        </div>
                                        <ShieldCheck className="text-blue-500" size={24} />
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                                        <div>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Age</div>
                                            <div className="font-bold text-slate-800 text-lg">{stats?.age || profileData.age ? `${stats?.age || profileData.age} Years` : 'N/A'}</div>
                                        </div>
                                        <Clock className="text-blue-500" size={24} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-xl">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Route Familiarity</div>
                                            <div className="text-2xl font-bold text-blue-600">{stats?.route_familiarity || profileData.route_familiarity || '3'}<span className="text-sm text-slate-400">/5</span></div>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-xl">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Skill Level</div>
                                            <div className="text-2xl font-bold text-green-600">{stats?.skill_level || profileData.skill_level || '5'}<span className="text-sm text-slate-400">/10</span></div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-xl">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Vehicle Handling Capacity</div>
                                        <div className="text-2xl font-bold text-purple-600">{stats?.vehicle_handling_capacity || profileData.vehicle_handling_capacity || '1500'} <span className="text-sm text-slate-400 font-normal">kg</span></div>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                                        <div>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Performance Score</div>
                                            <div className="font-bold text-slate-800 text-lg">{stats?.skill_index || '0'}</div>
                                        </div>
                                        <div className="text-yellow-500 text-xl">★</div>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                                        <div>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Rating</div>
                                            <div className="font-bold text-slate-800 text-lg">{stats?.avg_rating || '0'} Stars</div>
                                        </div>
                                        <div className="text-yellow-500">★★★★★</div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                                    <button
                                        onClick={() => setIsEditingProfile(true)}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                                    >
                                        Edit Profile
                                    </button>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
                                    ID: #{localStorage.getItem('userId')} • Joined 2023
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                    <p className="text-gray-500">Please select a tab to view content.</p>
                </div>
            )}

            {/* OTP Verification Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="bg-slate-900 p-6 text-white text-center">
                            <ShieldCheck size={48} className="mx-auto mb-2 text-green-400" />
                            <h3 className="text-xl font-bold">Secure Delivery Verification</h3>
                            <p className="text-slate-400 text-sm">Ask customer for the 6-digit OTP code</p>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* OTP Input */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                                    Delivery Code (OTP) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength="6"
                                    placeholder="000000"
                                    className="w-full text-center text-4xl font-mono tracking-[0.5em] py-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none focus:ring-4 focus:ring-green-500/20 transition-all text-slate-800"
                                    value={otpCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, ''); // Only numbers
                                        if (value.length <= 6) setOtpCode(value);
                                    }}
                                />
                                <p className="text-xs text-slate-500 mt-2 text-center">Enter the 6-digit code provided by the customer</p>
                            </div>

                            {/* Geo-Tagged Photo Upload (Required) */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                                    Proof of Delivery Photo <span className="text-red-500">*</span>
                                </label>
                                {podPhoto ? (
                                    <div className="relative">
                                        <img src={podPhoto} alt="POD Photo" className="w-full h-48 object-cover rounded-xl border-2 border-green-500" />
                                        {photoLatitude && photoLongitude && (
                                            <div className="absolute bottom-2 left-2 bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1">
                                                <MapPin size={12} />
                                                GPS: {photoLatitude.toFixed(6)}, {photoLongitude.toFixed(6)}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => {
                                                setPodPhoto(null);
                                                setPhotoLatitude(null);
                                                setPhotoLongitude(null);
                                                setPhotoTimestamp(null);
                                                setPhotoError('');
                                            }}
                                            className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-600"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={handleCapturePhoto}
                                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition cursor-pointer group"
                                    >
                                        <Camera className="mx-auto text-gray-400 mb-2 group-hover:text-blue-500" size={32} />
                                        <span className="text-sm text-gray-500 group-hover:text-blue-600 font-medium">Tap to capture photo with GPS</span>
                                        <p className="text-xs text-red-500 mt-2">Location services must be enabled</p>
                                    </div>
                                )}
                                {photoError && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                                        {photoError}
                                    </div>
                                )}
                                {!podPhoto && (
                                    <p className="text-xs text-slate-500 mt-2 text-center">
                                        Photo with GPS location is required for proof of delivery
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <button
                                    onClick={() => setShowOtpModal(false)}
                                    className="px-6 py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCompleteDelivery}
                                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-md transition"
                                >
                                    Verify & Complete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedJob && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Shipment Details</h3>
                            <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Client</label>
                                    <p className="font-medium text-slate-800">Customer #{selectedJob.customer_id}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Type</label>
                                    <p className="font-medium text-slate-800">Standard Freight</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold">Special Instructions</label>
                                    <p className="font-medium text-slate-800 bg-gray-50 p-2 rounded mt-1 text-sm border border-gray-100">
                                        Handle with care. Call recipient 10 mins before arrival.
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Weight</label>
                                    <p className="font-medium text-slate-800">24.5 kg</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase font-bold">Pieces</label>
                                    <p className="font-medium text-slate-800">3 Boxes</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                            <button onClick={() => setShowDetailsModal(false)} className="bg-white border border-gray-300 text-slate-700 px-6 py-2 rounded-lg font-bold hover:bg-gray-50 transition">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Location Permission Modal */}
            {showLocationPermissionModal && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        handleDenyLocation();
                    }
                }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center transform transition-all scale-100">
                        <div className="bg-blue-600 p-6 text-white">
                            <MapPin size={48} className="mx-auto mb-2 opacity-80" />
                            <h3 className="text-xl font-bold">Location Request</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 mb-6">
                                The Operator is requesting your real-time GPS location for tracking purposes. Do you want to share it?
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={handleDenyLocation}
                                    className="px-4 py-3 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition border border-slate-200"
                                >
                                    Deny
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAllowLocation();
                                    }}
                                    className="bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md"
                                >
                                    Allow
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Chatbot Component */}
            <Chatbot role="driver" />
        </DashboardLayout>
    );
};

export default DriverDashboard;
