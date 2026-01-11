import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import socket from '../utils/socket';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for driver location
const driverIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Component to update map bounds when locations change
function MapBoundsUpdater({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            try {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            } catch (e) {
                console.error('Map bounds error:', e);
            }
        }
    }, [bounds, map]);
    return null;
}

const MapComponent = (props) => {
    const { shipments = [], drivers = [], driverLocation, routeGeometry, showDriverLocation = false } = props;
    const [driverLocations, setDriverLocations] = useState({});

    useEffect(() => {
        const handleLocation = (data) => {
            setDriverLocations(prev => ({
                ...prev,
                [data.driverId]: { lat: data.lat, lng: data.lng, timestamp: Date.now() }
            }));
        };

        socket.on('driver:location', handleLocation);

        return () => {
            socket.off('driver:location', handleLocation);
        };
    }, []);

    // Determine center based on available data
    let center = [20.5937, 78.9629]; // Default (India)
    if (shipments && shipments.length > 0 && shipments[0].pickup_lat && shipments[0].pickup_lng) {
        center = [shipments[0].pickup_lat, shipments[0].pickup_lng];
    } else if (driverLocation) {
        center = [driverLocation.lat, driverLocation.lng];
    }

    // Calculate bounds for all markers
    const bounds = [];
    if (shipments && shipments.length > 0) {
        shipments.forEach(s => {
            if (s.pickup_lat && s.pickup_lng) bounds.push([s.pickup_lat, s.pickup_lng]);
            if (s.drop_lat && s.drop_lng) bounds.push([s.drop_lat, s.drop_lng]);
        });
    }
    if (driverLocation) bounds.push([driverLocation.lat, driverLocation.lng]);
    Object.values(driverLocations).forEach(loc => {
        if (loc.lat && loc.lng) bounds.push([loc.lat, loc.lng]);
    });

    // Filter locations: Only show drivers that exist in the 'drivers' prop
    // This removes "dummy" locations if the backend emits them for unknown IDs
    const validDriverLocations = Object.entries(driverLocations).filter(([id]) => {
        if (!drivers || drivers.length === 0) return true; // Show all if no drivers prop
        return drivers.some(d => String(d.id) === String(id));
    });

    return (
        <div className="h-full w-full" style={{ minHeight: '400px' }}>
            <MapContainer center={center} zoom={bounds.length > 1 ? undefined : 12} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {bounds.length > 1 && <MapBoundsUpdater bounds={bounds} />}

                {/* Render Shipment Markers (Pickup/Drop) */}
                {shipments && shipments.map((s, idx) => (
                    <div key={idx}>
                        {s.pickup_lat && s.pickup_lng && (
                            <Marker position={[s.pickup_lat, s.pickup_lng]}>
                                <Popup>
                                    <div className="text-sm">
                                        <strong>📍 Pickup Point</strong><br />
                                        <strong>Shipment:</strong> {s.tracking_number}<br />
                                        <strong>Origin:</strong> {s.origin || 'N/A'}<br />
                                        <strong>Status:</strong> {s.status || 'pending'}
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                        {s.drop_lat && s.drop_lng && (
                            <Marker position={[s.drop_lat, s.drop_lng]}>
                                <Popup>
                                    <div className="text-sm">
                                        <strong>🎯 Destination</strong><br />
                                        <strong>Shipment:</strong> {s.tracking_number}<br />
                                        <strong>Destination:</strong> {s.destination || 'N/A'}<br />
                                        <strong>Status:</strong> {s.status || 'pending'}
                                    </div>
                                </Popup>
                            </Marker>
                        )}
                    </div>
                ))}

                {/* Render Single Driver Location (from prop) - for customer view */}
                {showDriverLocation && driverLocation && (
                    <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
                        <Popup>
                            <div className="text-sm">
                                <strong>🚛 Driver Location</strong><br />
                                <strong>Status:</strong> In Transit<br />
                                <strong>Last Update:</strong> Just now
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Render Multiple Driver Live Locations (from socket) - for operator view */}
                {!showDriverLocation && validDriverLocations.map(([id, loc]) => {
                    const driver = drivers?.find(d => String(d.id) === String(id));
                    return (
                        <Marker key={`driver-${id}`} position={[loc.lat, loc.lng]} icon={driverIcon}>
                            <Popup>
                                <div className="text-sm">
                                    <strong>🚛 Driver #{id}</strong><br />
                                    <strong>Name:</strong> {driver?.name || driver?.email || 'Unknown'}<br />
                                    <strong>Level:</strong> {driver?.level || 'Standard'}<br />
                                    <strong>Status:</strong> {driver?.status || (driver?.active_shipment ? 'Busy' : 'Available')}<br />
                                    <strong>Rating:</strong> {driver?.skill_index || 'N/A'}/10<br />
                                    <strong>Last Update:</strong> {loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString() : 'Just now'}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Render Route Polyline (from shipment pickup to drop) */}
                {shipments && shipments.map((s, idx) => {
                    if (s.pickup_lat && s.pickup_lng && s.drop_lat && s.drop_lng) {
                        return (
                            <Polyline
                                key={`route-${idx}`}
                                positions={[[s.pickup_lat, s.pickup_lng], [s.drop_lat, s.drop_lng]]}
                                color="gray"
                                weight={2}
                                opacity={0.5}
                                dashArray="5, 5"
                            />
                        );
                    }
                    return null;
                })}

                {/* Render Optimal Route Geometry (from AI analysis) */}
                {routeGeometry && Array.isArray(routeGeometry) && routeGeometry.length > 0 && (
                    <Polyline
                        positions={routeGeometry}
                        color="blue"
                        weight={4}
                        opacity={0.8}
                    />
                )}

            </MapContainer>
        </div>
    );
};

export default MapComponent;
