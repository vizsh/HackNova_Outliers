import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import { Card, StatusBadge } from '../components/common/UI';
import { ArrowLeft, Phone, Clock, AlertTriangle, Navigation, MapPin } from 'lucide-react';
// NEW: Customer-facing components
import SmartOrderTracking from '../components/customer/SmartOrderTracking';
import CustomerControls from '../components/customer/CustomerControls';
import socket from '../utils/socket';

const CustomerTracking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [shipment, setShipment] = useState(null);
    const [driverLocation, setDriverLocation] = useState(null);
    const [eta, setEta] = useState('Calculating...');
    const [distance, setDistance] = useState(null);
    const [routeGeometry, setRouteGeometry] = useState(null);
    const [routeAnalysis, setRouteAnalysis] = useState(null);

    // Calculate ETA based on distance and driver location
    const calculateETA = (driverLoc, destination) => {
        if (!driverLoc || !destination) return null;
        
        // Simple distance calculation (Haversine approximation)
        const R = 6371; // Earth's radius in km
        const dLat = (destination.lat - driverLoc.lat) * Math.PI / 180;
        const dLng = (destination.lng - driverLoc.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(driverLoc.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        
        // Assume average speed of 50 km/h for city, 80 km/h for highway
        const avgSpeed = 60; // km/h
        const timeHours = distanceKm / avgSpeed;
        const timeMinutes = Math.round(timeHours * 60);
        
        return { distance: distanceKm, timeMinutes, formatted: timeMinutes < 60 ? `${timeMinutes} mins` : `${Math.floor(timeMinutes/60)}h ${timeMinutes%60}m` };
    };

    useEffect(() => {
        const fetchShipment = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await axios.get('http://localhost:3000/api/data/my-shipments', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const found = res.data.find(s => s.id == id);
                if (found) {
                    setShipment(found);
                    
                    // Fetch route analysis if shipment exists and has coordinates
                    if ((found.status === 'in_transit' || found.status === 'assigned' || found.status === 'pending') && 
                        found.pickup_lat && found.pickup_lng && found.drop_lat && found.drop_lng) {
                        try {
                            const routeRes = await axios.post('http://localhost:8000/analyze-route', {
                                origin_lat: found.pickup_lat,
                                origin_lng: found.pickup_lng,
                                dest_lat: found.drop_lat,
                                dest_lng: found.drop_lng,
                                origin_city: found.origin || "Unknown",
                                dest_city: found.destination || "Unknown",
                                freight_type: found.freight_type || "Standard",
                                weight: found.weight || 100,
                                deadline: found.deadline || null
                            });
                            setRouteAnalysis(routeRes.data);
                            setRouteGeometry(routeRes.data.geometry || null);
                            if (routeRes.data.eta) {
                                setEta(routeRes.data.eta.formatted_eta || `${routeRes.data.eta.time_minutes} mins`);
                                setDistance(routeRes.data.eta.distance_km);
                            } else if (routeRes.data.route) {
                                // Fallback to route summary if eta object doesn't exist
                                const timeMin = routeRes.data.route.time_min || 0;
                                const distKm = routeRes.data.route.distance_km || 0;
                                setEta(timeMin < 60 ? `${timeMin} mins` : `${Math.floor(timeMin/60)}h ${timeMin%60}m`);
                                setDistance(distKm);
                            }
                        } catch (err) {
                            console.error('Route analysis failed:', err);
                            // Set default ETA if route analysis fails
                            setEta('Calculating...');
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchShipment();
    }, [id]);

    // Separate effect for socket listener that depends on shipment
    useEffect(() => {
        if (!shipment || !shipment.driver_id) return;

        const handleDriverLocation = (data) => {
            // Check if this location is for the driver assigned to this shipment
            if (String(data.driverId) === String(shipment.driver_id)) {
                const location = { lat: data.lat, lng: data.lng, timestamp: data.timestamp };
                setDriverLocation(location);
                
                // Calculate ETA if we have destination
                if (shipment.drop_lat && shipment.drop_lng) {
                    const etaCalc = calculateETA(location, { lat: shipment.drop_lat, lng: shipment.drop_lng });
                    if (etaCalc) {
                        setEta(etaCalc.formatted);
                        setDistance(etaCalc.distance);
                    }
                }
            }
        };

        socket.on('driver:location', handleDriverLocation);

        return () => {
            socket.off('driver:location', handleDriverLocation);
        };
    }, [shipment]);

    if (!shipment) return <div className="p-8">Loading Shipments...</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white shadow-sm p-4 flex items-center gap-4">
                <button onClick={() => navigate('/customer')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Tracking #{shipment.tracking_number}</h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <StatusBadge status={shipment.status} />
                        <span>• {shipment.origin} &rarr; {shipment.destination}</span>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 relative">
                <div className="absolute inset-0 z-0">
                    <MapComponent 
                        shipments={[shipment]} 
                        driverLocation={driverLocation}
                        routeGeometry={routeGeometry}
                        showDriverLocation={true}
                    />
                </div>

                {/* NEW: Smart Order Tracking Card (Enhanced Customer View) */}
                <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-white p-6 rounded-xl shadow-2xl z-10 border border-gray-100 max-h-[600px] overflow-y-auto">
                    {/* Smart Order Tracking with ETA confidence bands and reliability */}
                    <SmartOrderTracking shipment={shipment} />

                    {/* NEW: Customer Controls */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <CustomerControls shipment={shipment} />
                    </div>

                    {/* Route Information (Customer-Friendly) */}
                    {routeAnalysis && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                <div>
                                    <div className="text-blue-600 font-semibold">Total Distance</div>
                                    <div className="text-slate-800 font-bold">{routeAnalysis.eta?.distance_km || routeAnalysis.route?.distance_km || 'N/A'} km</div>
                                </div>
                                <div>
                                    <div className="text-blue-600 font-semibold">Route Time</div>
                                    <div className="text-slate-800 font-bold">{routeAnalysis.eta?.formatted_eta || routeAnalysis.route?.time_min || 'N/A'}</div>
                                </div>
                            </div>
                            {routeAnalysis.weather && (
                                <div className="pt-2 border-t border-blue-200">
                                    <div className="text-xs text-blue-700">{routeAnalysis.weather.desc}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerTracking;
