/**
 * Synthetic Data Generator
 * 
 * Generates AI-enriched features for existing shipments and drivers
 * to make intelligence modules functional with mock database.
 */

const db = require('../db/index');

/**
 * Generate synthetic AI-enriched features for a shipment
 * 
 * @param {Object} shipment - Shipment from mock database
 * @returns {Object} Shipment with AI-enriched features
 */
function enrichShipment(shipment) {
    // Calculate distance for synthetic features
    const distance = calculateDistance(
        shipment.pickup_lat, shipment.pickup_lng,
        shipment.drop_lat, shipment.drop_lng
    );

    // Generate synthetic route difficulty based on distance and status
    const routeDifficulty = Math.min(1.0, Math.max(0.3, (distance / 200) * 0.7 + Math.random() * 0.3));
    
    // Generate synthetic traffic volatility (higher for urban areas, lower for rural)
    const trafficVolatility = shipment.status === 'in_transit' 
        ? 0.4 + Math.random() * 0.4  // More variability for in-transit
        : 0.3 + Math.random() * 0.3;

    // Generate synthetic weather severity (rare, but can happen)
    const weatherSeverity = Math.random() < 0.2 ? Math.random() * 0.6 : 0.0;

    // Determine delivery urgency based on freight type
    const freightType = shipment.freight_type || 'Standard';
    const deliveryUrgency = freightType === 'Fragile' || freightType === 'Perishable' 
        ? 'high' 
        : freightType === 'Hazardous' 
        ? 'medium' 
        : 'low';

    // Generate goods type (map from freight_type)
    const goodsTypeMap = {
        'Fragile': 'fragile',
        'Perishable': 'perishable',
        'Hazardous': 'high_value',
        'Standard': 'standard',
        'Oversized': 'standard'
    };
    const goodsType = goodsTypeMap[freightType] || 'standard';

    // Generate synthetic fatigue index (0.0 to 0.8, rarely above)
    const fatigueIndex = Math.random() < 0.3 ? Math.random() * 0.8 : 0.0;

    // Generate scheduled time based on distance (rough estimate: 1km per minute)
    const scheduledTimeMin = Math.round(distance * 1.2); // Include buffer

    return {
        ...shipment,
        // AI-enriched features
        order_id: shipment.tracking_number,
        rider_id: shipment.driver_id ? `R${shipment.driver_id}` : null,
        route_difficulty_score: parseFloat(routeDifficulty.toFixed(2)),
        traffic_volatility: parseFloat(trafficVolatility.toFixed(2)),
        weather_severity: parseFloat(weatherSeverity.toFixed(2)),
        delivery_urgency: deliveryUrgency,
        goods_type: goodsType,
        fatigue_index: parseFloat(fatigueIndex.toFixed(2)),
        base_distance_km: parseFloat(distance.toFixed(2)),
        scheduled_time_min: scheduledTimeMin,
        fuel_cost_est: parseFloat((distance * 0.15).toFixed(2)), // ₹0.15 per km
        pickup_lat: shipment.pickup_lat,
        pickup_lon: shipment.pickup_lng,
        drop_lat: shipment.drop_lat,
        drop_lon: shipment.drop_lng,
        city: shipment.origin?.split(',')[0] || 'Unknown',
        country: 'India',
        vehicle_type: 'bike'
    };
}

/**
 * Generate synthetic AI-enriched features for a driver
 * Based on their existing ratings and historical data
 * 
 * @param {Object} driver - Driver from mock database
 * @param {Array} driverShipments - Driver's historical shipments
 * @returns {Object} Driver with AI-enriched skill dimensions
 */
function enrichDriver(driver, driverShipments = []) {
    // Get driver's existing rating
    const rating = db.driver_ratings.find(r => r.driver_id === driver.id);
    
    // Base skill level from existing rating
    const baseSkill = rating?.skill_index ? rating.skill_index / 10 : 0.5; // Convert 0-10 to 0-1

    // Generate skill dimensions based on base skill with variation
    const variation = () => (Math.random() - 0.5) * 0.3; // ±15% variation
    
    // Skills should correlate with base skill but have individual variation
    const fragileHandling = Math.max(0.3, Math.min(1.0, baseSkill + variation()));
    const urgencyHandling = Math.max(0.3, Math.min(1.0, baseSkill + variation()));
    const nightDriving = Math.max(0.3, Math.min(1.0, baseSkill + variation()));
    const weatherResilience = Math.max(0.3, Math.min(1.0, baseSkill + variation()));
    
    // Consistency: derived from skill_index (higher skill = more consistent)
    const consistency = Math.max(0.4, Math.min(1.0, baseSkill + variation()));

    // Stress recovery: better drivers recover faster (inverse relationship with base skill)
    // Actually, better drivers also have better recovery, so positive correlation
    const stressRecovery = Math.max(0.4, Math.min(1.0, baseSkill + variation()));

    // Calculate delay recovery time (inverse of stress recovery)
    const avgDelayRecoveryTime = Math.round(30 + (1 - stressRecovery) * 30); // 30-60 minutes

    // Generate synthetic delivery history records for skill calculation
    const deliveryHistory = driverShipments.map(shipment => {
        const enriched = enrichShipment(shipment);
        return {
            rider_id: `R${driver.id}`,
            skill_fragile_handling: fragileHandling,
            skill_urgency_handling: urgencyHandling,
            skill_night_driving: nightDriving,
            skill_weather_resilience: weatherResilience,
            delay_recovery_time_min: avgDelayRecoveryTime,
            delay_minutes: shipment.status === 'delivered' ? Math.round(Math.random() * 20) : 0,
            delivery_success: shipment.status === 'delivered' ? 1 : 0,
            ...enriched
        };
    });

    return {
        driver,
        deliveryHistory,
        skillDimensions: {
            fragile_handling: parseFloat(fragileHandling.toFixed(2)),
            urgency_handling: parseFloat(urgencyHandling.toFixed(2)),
            night_driving: parseFloat(nightDriving.toFixed(2)),
            weather_resilience: parseFloat(weatherResilience.toFixed(2)),
            consistency: parseFloat(consistency.toFixed(2)),
            stress_recovery: parseFloat(stressRecovery.toFixed(2))
        }
    };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Generate synthetic feedback for a shipment
 */
function generateSyntheticFeedback(shipment, driver) {
    // Generate feedback based on shipment status and driver rating
    const rating = db.driver_ratings.find(r => r.driver_id === driver?.id);
    const avgRating = rating?.skill_index ? (rating.skill_index / 10) * 4 + 1 : 3.5; // Scale 0-1 to 1-5

    const feedbacks = [
        { text: 'Excellent service, on-time delivery!', rating: 5.0 },
        { text: 'Good service, driver was professional and careful with fragile items.', rating: 4.5 },
        { text: 'Satisfactory delivery. Could have been faster.', rating: 3.5 },
        { text: 'Driver was polite and careful. Delivery was slightly delayed.', rating: 4.0 },
        { text: 'Package arrived in good condition. Communication could be better.', rating: 3.8 }
    ];

    // Select feedback based on rating
    let selectedFeedback;
    if (avgRating >= 4.5) {
        selectedFeedback = feedbacks[0];
    } else if (avgRating >= 4.0) {
        selectedFeedback = feedbacks[1];
    } else if (avgRating >= 3.5) {
        selectedFeedback = feedbacks[3];
    } else {
        selectedFeedback = feedbacks[2];
    }

    return {
        customer_feedback_text: selectedFeedback.text,
        customer_rating: avgRating,
        delay_minutes: shipment.status === 'delivered' ? Math.round(Math.random() * 30) : 0,
        delivery_urgency: shipment.freight_type === 'Fragile' ? 'high' : 'medium'
    };
}

module.exports = {
    enrichShipment,
    enrichDriver,
    generateSyntheticFeedback,
    calculateDistance
};
