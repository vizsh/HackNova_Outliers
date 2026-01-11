/**
 * Intelligence API Utility
 * 
 * Provides functions to call intelligence decision-support endpoints.
 * All endpoints require authentication and return explainable recommendations.
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api/intelligence';

/**
 * Get authorization token from localStorage
 */
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
};

/**
 * Get comprehensive intelligence analysis for a delivery
 * 
 * @param {Object} delivery - Delivery record
 * @param {string} driverId - Optional driver ID
 * @returns {Promise<Object>} Comprehensive analysis
 */
export const getComprehensiveAnalysis = async (delivery, driverId = null) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/comprehensive-analysis`,
            { delivery, driverId },
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error getting comprehensive analysis:', error);
        throw error;
    }
};

/**
 * Get driver skill profile
 * 
 * @param {string} driverId - Driver ID (rider_id format, e.g., "R2") or numeric userId
 * @param {number} userId - Optional numeric user ID (alternative to driverId)
 * @returns {Promise<Object>} Driver skill profile
 */
export const getDriverSkillProfile = async (driverId, userId = null) => {
    try {
        const body = {};
        if (driverId) {
            body.driverId = driverId;
        }
        if (userId) {
            body.userId = userId;
        }
        if (!body.driverId && !body.userId) {
            throw new Error('driverId or userId must be provided');
        }
        
        const response = await axios.post(
            `${API_BASE_URL}/driver-skill-profile`,
            body,
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error getting driver skill profile:', error);
        throw error;
    }
};

/**
 * Analyze route risk
 * 
 * @param {Object} delivery - Delivery record with route characteristics (optional if shipmentId provided)
 * @param {string|number} shipmentId - Shipment ID or tracking number (optional, preferred)
 * @returns {Promise<Object>} Route risk analysis
 */
export const analyzeRouteRisk = async (delivery = null, shipmentId = null) => {
    try {
        const body = {};
        if (shipmentId) {
            body.shipmentId = shipmentId;
        } else if (delivery) {
            body.delivery = delivery;
        } else {
            throw new Error('Either delivery or shipmentId must be provided');
        }
        
        const response = await axios.post(
            `${API_BASE_URL}/route-risk-analysis`,
            body,
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error analyzing route risk:', error);
        throw error;
    }
};

/**
 * Calculate driver-route fit
 * 
 * @param {Object} driverProfile - Driver skill profile
 * @param {Object} routeAnalysis - Route risk analysis
 * @param {Object} deliveryContext - Delivery context (urgency, fatigue, goods_type)
 * @returns {Promise<Object>} Driver-route fit analysis
 */
export const calculateDriverRouteFit = async (driverProfile, routeAnalysis, deliveryContext = {}) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/driver-route-fit`,
            { driverProfile, routeAnalysis, deliveryContext },
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error calculating driver-route fit:', error);
        throw error;
    }
};

/**
 * Predict delivery delay
 * 
 * @param {Object} routeAnalysis - Route risk analysis (optional if shipmentId provided)
 * @param {Object} driverProfile - Optional driver profile
 * @param {Object} deliveryContext - Delivery context (fatigue, distance, scheduled_time)
 * @param {string|number} shipmentId - Shipment ID or tracking number (optional, preferred)
 * @param {string} driverId - Driver ID in format "R2" (optional)
 * @returns {Promise<Object>} Delay prediction
 */
export const predictDelay = async (routeAnalysis = null, driverProfile = null, deliveryContext = {}, shipmentId = null, driverId = null) => {
    try {
        const body = {};
        if (shipmentId) {
            body.shipmentId = shipmentId;
        }
        if (driverId) {
            body.driverId = driverId;
        }
        if (routeAnalysis) {
            body.routeAnalysis = routeAnalysis;
        }
        if (driverProfile) {
            body.driverProfile = driverProfile;
        }
        if (Object.keys(deliveryContext).length > 0) {
            body.deliveryContext = deliveryContext;
        }
        
        const response = await axios.post(
            `${API_BASE_URL}/delay-prediction`,
            body,
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error predicting delay:', error);
        throw error;
    }
};

/**
 * Compare multiple drivers for a delivery
 * 
 * @param {Object} delivery - Delivery record
 * @param {Array<string>} driverIds - Array of driver IDs to compare
 * @returns {Promise<Object>} Driver comparison result
 */
export const compareDrivers = async (delivery, driverIds) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/compare-drivers`,
            { delivery, driverIds },
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error comparing drivers:', error);
        throw error;
    }
};

/**
 * Analyze customer feedback attribution
 * 
 * @param {Object} feedback - Feedback record with text
 * @param {Object} deliveryContext - Delivery context (delay, urgency)
 * @returns {Promise<Object>} Feedback attribution analysis
 */
export const analyzeFeedbackAttribution = async (feedback, deliveryContext = {}) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/feedback-attribution`,
            { feedback, deliveryContext },
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error analyzing feedback attribution:', error);
        throw error;
    }
};

/**
 * Track operator override for learning
 * 
 * @param {Object} overrideEvent - Override event details
 * @param {Object} originalRecommendation - Original system recommendation
 * @param {Object} actualDecision - Actual operator decision
 * @returns {Promise<Object>} Learning signal
 */
export const trackOverride = async (overrideEvent, originalRecommendation, actualDecision) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/track-override`,
            { overrideEvent, originalRecommendation, actualDecision },
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error tracking override:', error);
        throw error;
    }
};
