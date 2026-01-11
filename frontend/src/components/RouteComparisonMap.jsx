/**
 * Route Comparison Map Component
 * 
 * Shows current and alternative routes side-by-side on a map
 * with ETAs, costs, and transportation modes
 */

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different route types
const currentRouteIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const alternativeRouteIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function MapBoundsUpdater({ bounds }) {
    const map = useMap();
    useEffect(() => {
        if (bounds && bounds.length > 0) {
            try {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
            } catch (e) {
                console.error('Map bounds error:', e);
            }
        }
    }, [bounds, map]);
    return null;
}

const RouteComparisonMap = ({ 
    shipment, 
    currentRoute = null, 
    alternativeRoute = null,
    currentTransportMode = 'road',
    alternativeTransportMode = 'road',
    currentETA = null,
    alternativeETA = null,
    currentCost = null,
    alternativeCost = null
}) => {
    if (!shipment || !shipment.pickup_lat || !shipment.pickup_lng || !shipment.drop_lat || !shipment.drop_lng) {
        return (
            <div className="h-full w-full bg-slate-100 rounded-lg flex items-center justify-center">
                <p className="text-slate-500">Map data not available</p>
            </div>
        );
    }

    const center = [
        (shipment.pickup_lat + shipment.drop_lat) / 2,
        (shipment.pickup_lng + shipment.drop_lng) / 2
    ];

    const bounds = [
        [shipment.pickup_lat, shipment.pickup_lng],
        [shipment.drop_lat, shipment.drop_lng]
    ];

    // Generate route geometry (in real app, would use routing API)
    const currentRouteGeometry = currentRoute || [
        [shipment.pickup_lat, shipment.pickup_lng],
        [shipment.drop_lat, shipment.drop_lng]
    ];

    // Alternative route with slight variation (simulated)
    const alternativeRouteGeometry = alternativeRoute || (() => {
        const midLat = (shipment.pickup_lat + shipment.drop_lat) / 2 + 0.05;
        const midLng = (shipment.pickup_lng + shipment.drop_lng) / 2 + 0.05;
        return [
            [shipment.pickup_lat, shipment.pickup_lng],
            [midLat, midLng],
            [shipment.drop_lat, shipment.drop_lng]
        ];
    })();

    const getTransportIcon = (mode) => {
        switch(mode?.toLowerCase()) {
            case 'air': return '✈️';
            case 'water': return '🚢';
            default: return '🚛';
        }
    };

    const getTransportLabel = (mode) => {
        switch(mode?.toLowerCase()) {
            case 'air': return 'Air Freight';
            case 'water': return 'Maritime';
            default: return 'Road Transport';
        }
    };

    return (
        <div className="h-full w-full" style={{ minHeight: '400px' }}>
            <MapContainer 
                center={center} 
                zoom={8} 
                scrollWheelZoom={true} 
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapBoundsUpdater bounds={bounds} />

                {/* Pickup Point */}
                <Marker position={[shipment.pickup_lat, shipment.pickup_lng]}>
                    <Popup>
                        <div className="text-sm">
                            <strong>📍 Pickup Point</strong><br />
                            {shipment.origin || 'Origin'}
                        </div>
                    </Popup>
                </Marker>

                {/* Drop Point */}
                <Marker position={[shipment.drop_lat, shipment.drop_lng]}>
                    <Popup>
                        <div className="text-sm">
                            <strong>🎯 Destination</strong><br />
                            {shipment.destination || 'Destination'}
                        </div>
                    </Popup>
                </Marker>

                {/* Current Route */}
                <Polyline
                    positions={currentRouteGeometry}
                    color="#ef4444"
                    weight={4}
                    opacity={0.8}
                    dashArray="10, 5"
                >
                    <Popup>
                        <div className="text-sm">
                            <strong>Current Route</strong><br />
                            Mode: {getTransportIcon(currentTransportMode)} {getTransportLabel(currentTransportMode)}<br />
                            {currentETA && `ETA: ${currentETA}`}<br />
                            {currentCost && `Cost: ₹${currentCost}`}
                        </div>
                    </Popup>
                </Polyline>

                {/* Alternative Route */}
                {alternativeRouteGeometry && (
                    <Polyline
                        positions={alternativeRouteGeometry}
                        color="#3b82f6"
                        weight={4}
                        opacity={0.8}
                    >
                        <Popup>
                            <div className="text-sm">
                                <strong>Alternative Route</strong><br />
                                Mode: {getTransportIcon(alternativeTransportMode)} {getTransportLabel(alternativeTransportMode)}<br />
                                {alternativeETA && `ETA: ${alternativeETA}`}<br />
                                {alternativeCost && `Cost: ₹${alternativeCost}`}
                            </div>
                        </Popup>
                    </Polyline>
                )}

            </MapContainer>
            
            {/* Legend */}
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Route Legend</div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-red-500 opacity-80" style={{ borderTop: '2px dashed #ef4444' }}></div>
                        <span>Current Route ({getTransportIcon(currentTransportMode)})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-1 bg-blue-500 opacity-80"></div>
                        <span>Alternative Route ({getTransportIcon(alternativeTransportMode)})</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteComparisonMap;
