/**
 * Customer Intelligence Service
 * 
 * Provides customer-facing intelligence features with simplified, non-technical outputs.
 * 
 * BOUNDARY: This service ONLY formats data for customer consumption.
 * It does NOT modify core delivery logic or decision-making.
 * All calculations use existing intelligence modules.
 * 
 * FEATURES:
 * - ETA with confidence bands (customer-friendly format)
 * - Delivery reliability indicator (HIGH/MEDIUM/LOW)
 * - Human-readable status explanations
 * 
 * IMPORTANT:
 * - NO internal KPIs exposed
 * - NO driver scores or probabilities shown
 * - ONLY customer-appropriate information
 */

const delayPrediction = require('./delayPrediction');
const routeRiskAnalyzer = require('./routeRiskAnalyzer');
const syntheticDataGenerator = require('./syntheticDataGenerator');

/**
 * Get customer-friendly ETA with confidence band
 * 
 * Returns ETA in format like "3:10-3:25 PM" with explanation.
 * Uses delay prediction but formats for customer consumption.
 * 
 * @param {string|number} shipmentId - Shipment ID or tracking number
 * @returns {Object} Customer-friendly ETA information
 */
async function getCustomerETA(shipmentId) {
    try {
        // Get shipment data (using database)
        const db = require('../db');
        // Try database first
        let shipmentResult = await db.query('SELECT * FROM shipments WHERE id = $1 OR tracking_number = $1', [shipmentId]);
        let shipment = shipmentResult.rows && shipmentResult.rows.length > 0 ? shipmentResult.rows[0] : null;
        
        // Fallback to in-memory if available
        if (!shipment && db.shipments) {
            const shipments = db.shipments || [];
            shipment = shipments.find(s => 
                String(s.id) === String(shipmentId) || 
                s.tracking_number === String(shipmentId)
            );
        }
        
        if (!shipment) {
            return {
                error: 'Shipment not found',
                eta_range: null,
                confidence_level: null
            };
        }

        // Enrich shipment for analysis
        const enriched = syntheticDataGenerator.enrichShipment(shipment);
        
        // Get route risk analysis (uses existing module)
        const routeAnalysis = routeRiskAnalyzer.analyzeRouteRisk(enriched);
        
        // Get delay prediction (uses existing module)
        const delayPred = delayPrediction.predictDelay(
            routeAnalysis,
            null, // No driver profile for customer view
            {
                base_distance_km: enriched.base_distance_km || null,
                scheduled_time_min: enriched.scheduled_time_min || null,
                fatigue_index: 0.0 // Don't expose fatigue to customers
            }
        );

        // Calculate base ETA (assuming 60 km/h average speed)
        const distance = enriched.base_distance_km || 50;
        const baseTimeMinutes = (distance / 60) * 60; // Convert to minutes
        const predictedDelay = delayPred.predicted_delay_minutes || 0;
        
        // Calculate confidence band (based on delay prediction confidence)
        const confidence = delayPred.prediction_confidence || 0.7;
        const uncertaintyMinutes = Math.round((1 - confidence) * 20); // Max 20 min uncertainty
        
        // Calculate ETA range
        const now = new Date();
        const baseETA = new Date(now.getTime() + (baseTimeMinutes + predictedDelay) * 60000);
        const minETA = new Date(baseETA.getTime() - uncertaintyMinutes * 60000);
        const maxETA = new Date(baseETA.getTime() + uncertaintyMinutes * 60000);
        
        // Format for customer (e.g., "3:10-3:25 PM")
        const formatTime = (date) => {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        };
        
        const etaRange = `${formatTime(minETA)} - ${formatTime(maxETA)}`;
        
        // Determine confidence level for display
        let confidenceLevel = 'MEDIUM';
        if (confidence >= 0.8) confidenceLevel = 'HIGH';
        else if (confidence < 0.6) confidenceLevel = 'LOW';
        
        // Generate human-readable explanation (customer-friendly)
        let statusExplanation = 'Your delivery is on schedule.';
        if (delayPred.delay_risk_band === 'high') {
            statusExplanation = 'Your delivery may experience delays due to route conditions or traffic. We\'ll keep you updated.';
        } else if (delayPred.delay_risk_band === 'medium') {
            statusExplanation = 'Your delivery is progressing normally. Minor delays are possible.';
        }
        
        // Add delay reasons if significant
        const delayReasons = [];
        if (routeAnalysis.risk_contributors?.weather_severity?.raw_score > 0.5) {
            delayReasons.push('weather conditions');
        }
        if (routeAnalysis.risk_contributors?.traffic_volatility?.raw_score > 0.5) {
            delayReasons.push('traffic conditions');
        }
        if (routeAnalysis.risk_contributors?.road_conditions?.raw_score > 0.5) {
            delayReasons.push('route conditions');
        }
        
        if (delayReasons.length > 0) {
            statusExplanation += ` Factors affecting delivery: ${delayReasons.join(', ')}.`;
        }
        
        return {
            shipment_id: shipmentId,
            eta_range: etaRange,
            eta_min: formatTime(minETA),
            eta_max: formatTime(maxETA),
            estimated_arrival: formatTime(baseETA),
            confidence_level: confidenceLevel,
            confidence_score: confidence,
            status_explanation: statusExplanation,
            delay_risk_band: delayPred.delay_risk_band || 'low',
            // NO internal metrics exposed
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting customer ETA:', error);
        return {
            error: 'Unable to calculate ETA',
            eta_range: null,
            confidence_level: null
        };
    }
}

/**
 * Get delivery reliability indicator
 * 
 * Returns HIGH/MEDIUM/LOW based on:
 * - Route difficulty
 * - Weather severity
 * - Delivery urgency
 * 
 * BOUNDARY: This is presentation-only. Does not affect delivery logic.
 * 
 * @param {string|number} shipmentId - Shipment ID or tracking number
 * @returns {Object} Reliability indicator information
 */
async function getDeliveryReliability(shipmentId) {
    try {
        const db = require('../db');
        // Try database first
        let shipmentResult = await db.query('SELECT * FROM shipments WHERE id = $1 OR tracking_number = $1', [shipmentId]);
        let shipment = shipmentResult.rows && shipmentResult.rows.length > 0 ? shipmentResult.rows[0] : null;
        
        // Fallback to in-memory if available
        if (!shipment && db.shipments) {
            const shipments = db.shipments || [];
            shipment = shipments.find(s => 
                String(s.id) === String(shipmentId) || 
                s.tracking_number === String(shipmentId)
            );
        }
        
        if (!shipment) {
            return {
                error: 'Shipment not found',
                reliability: null
            };
        }

        // Enrich shipment
        const enriched = syntheticDataGenerator.enrichShipment(shipment);
        
        // Get route analysis (uses existing module)
        const routeAnalysis = routeRiskAnalyzer.analyzeRouteRisk(enriched);
        
        // Calculate reliability factors (presentation-layer only)
        const routeDifficulty = routeAnalysis.normalized_difficulty || 0.5;
        const weatherSeverity = routeAnalysis.risk_contributors?.weather_severity?.raw_score || 0.0;
        const deliveryUrgency = enriched.delivery_urgency === 'high' ? 0.8 : 
                               enriched.delivery_urgency === 'low' ? 0.2 : 0.5;
        
        // Combine factors (weighted average)
        const reliabilityScore = 1 - (
            (routeDifficulty * 0.4) + 
            (weatherSeverity * 0.4) + 
            ((1 - deliveryUrgency) * 0.2) // Lower urgency = higher reliability
        );
        
        // Map to HIGH/MEDIUM/LOW
        let reliability = 'MEDIUM';
        let color = 'yellow';
        if (reliabilityScore >= 0.7) {
            reliability = 'HIGH';
            color = 'green';
        } else if (reliabilityScore < 0.4) {
            reliability = 'LOW';
            color = 'red';
        }
        
        // Generate explanation
        let explanation = 'Delivery reliability looks ';
        if (reliability === 'HIGH') {
            explanation += 'strong with favorable conditions.';
        } else if (reliability === 'LOW') {
            explanation += 'challenged due to route or weather conditions.';
        } else {
            explanation += 'moderate with some variables.';
        }
        
        return {
            shipment_id: shipmentId,
            reliability: reliability,
            reliability_score: Math.round(reliabilityScore * 100),
            color: color,
            explanation: explanation,
            factors: {
                route_difficulty: routeDifficulty < 0.4 ? 'low' : routeDifficulty < 0.7 ? 'medium' : 'high',
                weather_severity: weatherSeverity < 0.3 ? 'low' : weatherSeverity < 0.6 ? 'medium' : 'high',
                delivery_urgency: deliveryUrgency
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting delivery reliability:', error);
        return {
            error: 'Unable to calculate reliability',
            reliability: null
        };
    }
}

module.exports = {
    getCustomerETA,
    getDeliveryReliability
};
