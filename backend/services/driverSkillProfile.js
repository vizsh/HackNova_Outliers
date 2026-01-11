/**
 * Driver Skill Profile Engine
 * 
 * Computes multi-dimensional skill vectors for drivers based on historical performance data.
 * 
 * DECISION-SUPPORT ONLY: This module provides insights but does NOT auto-execute decisions.
 * All outputs are explainable and preserve individual skill dimensions separately.
 * 
 * IMPORTANT: Do NOT collapse skills into a single score. Each dimension is preserved
 * for granular matching and explainability.
 */

/**
 * Compute multi-dimensional skill profile for a driver
 * 
 * @param {Array} deliveryHistory - Array of delivery records from dataset
 * @param {string} riderId - Driver's rider_id (e.g., "R4110")
 * @returns {Object} Multi-dimensional skill profile with explainable breakdown
 */
function computeDriverSkillProfile(deliveryHistory, riderId) {
    // Filter deliveries for this specific driver
    const driverDeliveries = deliveryHistory.filter(d => d.rider_id === riderId);
    
    if (driverDeliveries.length === 0) {
        return createDefaultSkillProfile(riderId, 'No delivery history available');
    }
    
    // Extract skill dimensions (already 0-1 scale from dataset)
    const fragileHandlingScores = driverDeliveries.map(d => parseFloat(d.skill_fragile_handling) || 0);
    const urgencyHandlingScores = driverDeliveries.map(d => parseFloat(d.skill_urgency_handling) || 0);
    const nightDrivingScores = driverDeliveries.map(d => parseFloat(d.skill_night_driving) || 0);
    const weatherResilienceScores = driverDeliveries.map(d => parseFloat(d.skill_weather_resilience) || 0);
    
    // Calculate Consistency (derived from delay variance)
    // Lower variance = higher consistency
    const delayMinutes = driverDeliveries.map(d => parseFloat(d.delay_minutes) || 0);
    const consistencyScore = calculateConsistency(delayMinutes);
    
    // Calculate Stress Recovery (from delay_recovery_time_min)
    // Lower recovery time = better stress recovery ability
    const recoveryTimes = driverDeliveries.map(d => parseInt(d.delay_recovery_time_min) || 0);
    const stressRecoveryScore = calculateStressRecovery(recoveryTimes);
    
    // Compute averages for each dimension (preserved separately, not collapsed)
    const skillVector = {
        fragile_handling: computeWeightedAverage(fragileHandlingScores),
        urgency_handling: computeWeightedAverage(urgencyHandlingScores),
        night_driving: computeWeightedAverage(nightDrivingScores),
        weather_resilience: computeWeightedAverage(weatherResilienceScores),
        consistency: consistencyScore,
        stress_recovery: stressRecoveryScore
    };
    
    // Build explainable breakdown
    const explanation = buildSkillExplanation(skillVector, driverDeliveries.length);
    
    return {
        rider_id: riderId,
        skill_vector: skillVector,
        metadata: {
            total_deliveries: driverDeliveries.length,
            delivery_success_rate: calculateSuccessRate(driverDeliveries),
            avg_delay_minutes: calculateAverage(delayMinutes),
            profile_confidence: calculateProfileConfidence(driverDeliveries.length)
        },
        explanation: explanation,
        timestamp: new Date().toISOString()
    };
}

/**
 * Calculate Consistency Score (0-1 scale)
 * 
 * Consistency is measured by delay variance:
 * - Low variance (consistent delays) = High consistency score
 * - High variance (unpredictable delays) = Low consistency score
 * 
 * @param {Array<number>} delayMinutes - Array of delay minutes from deliveries
 * @returns {number} Consistency score (0-1, higher = more consistent)
 */
function calculateConsistency(delayMinutes) {
    if (delayMinutes.length < 2) {
        return 0.5; // Default for insufficient data
    }
    
    const mean = calculateAverage(delayMinutes);
    const variance = delayMinutes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / delayMinutes.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize consistency: lower stdDev = higher consistency
    // Using exponential decay: consistency = e^(-stdDev / normalization_factor)
    // Normalization factor of 30 means: stdDev of 30 mins = ~0.37 consistency
    const normalizationFactor = 30;
    const consistency = Math.exp(-stdDev / normalizationFactor);
    
    // Ensure result is between 0 and 1
    return Math.max(0, Math.min(1, consistency));
}

/**
 * Calculate Stress Recovery Score (0-1 scale)
 * 
 * Stress Recovery measures how quickly a driver recovers from delays:
 * - Lower delay_recovery_time_min = Higher stress recovery score
 * - Higher delay_recovery_time_min = Lower stress recovery score
 * 
 * @param {Array<number>} recoveryTimes - Array of delay_recovery_time_min values
 * @returns {number} Stress recovery score (0-1, higher = faster recovery)
 */
function calculateStressRecovery(recoveryTimes) {
    if (recoveryTimes.length === 0) {
        return 0.5; // Default for no data
    }
    
    // Filter out invalid values
    const validRecoveryTimes = recoveryTimes.filter(t => t >= 0 && t <= 120); // Reasonable range 0-120 mins
    
    if (validRecoveryTimes.length === 0) {
        return 0.5;
    }
    
    const avgRecoveryTime = calculateAverage(validRecoveryTimes);
    
    // Normalize: Lower recovery time = higher score
    // Using inverse relationship with max expected recovery time of 60 mins
    // recovery_time of 0 = score of 1.0
    // recovery_time of 60 = score of 0.0
    const maxRecoveryTime = 60;
    const recoveryScore = Math.max(0, 1 - (avgRecoveryTime / maxRecoveryTime));
    
    return recoveryScore;
}

/**
 * Compute weighted average for skill scores
 * 
 * Uses recency weighting (more recent deliveries weighted higher) if we have
 * delivery dates, otherwise simple average.
 * 
 * @param {Array<number>} scores - Array of skill scores (0-1)
 * @param {Array<Date>} deliveryDates - Optional array of delivery dates for recency weighting
 * @returns {number} Weighted average score (0-1)
 */
function computeWeightedAverage(scores, deliveryDates = null) {
    if (scores.length === 0) {
        return 0.5; // Default neutral score
    }
    
    // If no dates provided, use simple average
    if (!deliveryDates || deliveryDates.length !== scores.length) {
        const sum = scores.reduce((acc, val) => acc + val, 0);
        return sum / scores.length;
    }
    
    // Recency weighting: more recent deliveries contribute more
    const now = new Date();
    const weights = deliveryDates.map(date => {
        const daysSince = (now - new Date(date)) / (1000 * 60 * 60 * 24);
        // Exponential decay: deliveries from 30 days ago have 50% weight
        return Math.exp(-daysSince / 30);
    });
    
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    const weightedSum = scores.reduce((acc, score, idx) => acc + (score * weights[idx]), 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : calculateAverage(scores);
}

/**
 * Calculate delivery success rate
 * 
 * @param {Array} deliveries - Array of delivery records
 * @returns {number} Success rate (0-1)
 */
function calculateSuccessRate(deliveries) {
    if (deliveries.length === 0) return 0;
    
    const successes = deliveries.filter(d => parseInt(d.delivery_success) === 1).length;
    return successes / deliveries.length;
}

/**
 * Calculate profile confidence based on sample size
 * 
 * More historical data = higher confidence in the profile
 * 
 * @param {number} sampleSize - Number of deliveries used to build profile
 * @returns {number} Confidence level (0-1)
 */
function calculateProfileConfidence(sampleSize) {
    // Confidence increases with sample size, but with diminishing returns
    // 1 delivery = 0.2 confidence
    // 10 deliveries = 0.7 confidence
    // 50+ deliveries = 0.95+ confidence
    const maxConfidence = 0.95;
    const minConfidence = 0.2;
    
    if (sampleSize <= 1) return minConfidence;
    if (sampleSize >= 50) return maxConfidence;
    
    // Exponential growth: confidence = min + (max - min) * (1 - e^(-samples/10))
    const normalizedSamples = sampleSize / 10;
    const confidence = minConfidence + (maxConfidence - minConfidence) * (1 - Math.exp(-normalizedSamples));
    
    return Math.round(confidence * 100) / 100; // Round to 2 decimals
}

/**
 * Build human-readable explanation of skill profile
 * 
 * @param {Object} skillVector - Multi-dimensional skill vector
 * @param {number} deliveryCount - Number of deliveries analyzed
 * @returns {Object} Explanation object with text and highlights
 */
function buildSkillExplanation(skillVector, deliveryCount) {
    const explanations = [];
    const highlights = [];
    
    // Explain each dimension
    if (skillVector.fragile_handling >= 0.7) {
        explanations.push('Strong fragile goods handling capability');
        highlights.push('Excellent with delicate packages');
    } else if (skillVector.fragile_handling >= 0.4) {
        explanations.push('Moderate fragile goods handling capability');
    } else {
        explanations.push('May need additional training for fragile goods');
        highlights.push('Consider assigning standard/fragile packages');
    }
    
    if (skillVector.urgency_handling >= 0.7) {
        explanations.push('High proficiency in urgent delivery scenarios');
        highlights.push('Recommended for time-sensitive shipments');
    } else if (skillVector.urgency_handling < 0.4) {
        explanations.push('Less experienced with urgent deliveries');
    }
    
    if (skillVector.night_driving >= 0.7) {
        explanations.push('Strong night driving performance');
        highlights.push('Suitable for night shift assignments');
    } else if (skillVector.night_driving < 0.4) {
        explanations.push('Better suited for daytime deliveries');
    }
    
    if (skillVector.weather_resilience >= 0.7) {
        explanations.push('Resilient to adverse weather conditions');
        highlights.push('Can handle challenging weather routes');
    } else if (skillVector.weather_resilience < 0.4) {
        explanations.push('May require weather-sensitive route planning');
    }
    
    if (skillVector.consistency >= 0.7) {
        explanations.push('Highly consistent delivery performance');
        highlights.push('Predictable delivery times');
    } else if (skillVector.consistency < 0.4) {
        explanations.push('Variable delivery performance');
        highlights.push('Consider route difficulty when assigning');
    }
    
    if (skillVector.stress_recovery >= 0.7) {
        explanations.push('Quick recovery from delays and disruptions');
        highlights.push('Maintains performance under pressure');
    } else if (skillVector.stress_recovery < 0.4) {
        explanations.push('May need more recovery time after delays');
    }
    
    return {
        summary: `Skill profile based on ${deliveryCount} historical deliveries`,
        detailed_explanations: explanations,
        key_highlights: highlights,
        interpretation_guide: {
            score_scale: '0.0 (needs improvement) to 1.0 (excellent)',
            confidence: calculateProfileConfidence(deliveryCount),
            last_updated: new Date().toISOString()
        }
    };
}

/**
 * Create default skill profile when insufficient data
 * 
 * @param {string} riderId - Driver's rider_id
 * @param {string} reason - Reason for default profile
 * @returns {Object} Default skill profile
 */
function createDefaultSkillProfile(riderId, reason) {
    return {
        rider_id: riderId,
        skill_vector: {
            fragile_handling: 0.5,
            urgency_handling: 0.5,
            night_driving: 0.5,
            weather_resilience: 0.5,
            consistency: 0.5,
            stress_recovery: 0.5
        },
        metadata: {
            total_deliveries: 0,
            delivery_success_rate: 0,
            avg_delay_minutes: 0,
            profile_confidence: 0.2
        },
        explanation: {
            summary: reason,
            detailed_explanations: ['Default profile - insufficient historical data'],
            key_highlights: [],
            interpretation_guide: {
                score_scale: 'Default neutral scores (0.5) used',
                confidence: 0.2,
                last_updated: new Date().toISOString()
            }
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * Helper: Calculate average
 */
function calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    return sum / numbers.length;
}

/**
 * Get skill profile for a driver from aggregated data
 * 
 * This is a convenience function that can be used with the dataset adapter output
 * 
 * @param {Array} deliveries - Array of delivery records (from dataset adapter)
 * @param {string} riderId - Driver's rider_id
 * @returns {Object} Driver skill profile
 */
function getDriverSkillProfile(deliveries, riderId) {
    return computeDriverSkillProfile(deliveries, riderId);
}

/**
 * Compare two drivers' skill profiles for a specific route type
 * 
 * DECISION-SUPPORT: This helps operators understand which driver might be better
 * suited for a specific delivery type, but does NOT auto-assign.
 * 
 * @param {Object} profile1 - First driver's skill profile
 * @param {Object} profile2 - Second driver's skill profile
 * @param {Object} routeRequirements - Requirements for the route (e.g., { fragile: true, urgent: true })
 * @returns {Object} Comparison result with explanation
 */
function compareDriverProfiles(profile1, profile2, routeRequirements = {}) {
    const comparison = {
        driver1_id: profile1.rider_id,
        driver2_id: profile2.rider_id,
        dimension_comparisons: {},
        overall_fit: {},
        recommendation: '',
        explanation: ''
    };
    
    const dimensions = ['fragile_handling', 'urgency_handling', 'night_driving', 'weather_resilience', 'consistency', 'stress_recovery'];
    
    // Compare each dimension
    dimensions.forEach(dim => {
        const score1 = profile1.skill_vector[dim];
        const score2 = profile2.skill_vector[dim];
        
        comparison.dimension_comparisons[dim] = {
            driver1_score: score1,
            driver2_score: score2,
            difference: Math.abs(score1 - score2),
            better_driver: score1 > score2 ? profile1.rider_id : score2 > score1 ? profile2.rider_id : 'tie'
        };
    });
    
    // Calculate overall fit if route requirements specified
    if (Object.keys(routeRequirements).length > 0) {
        let fit1 = 0, fit2 = 0;
        let reasons1 = [], reasons2 = [];
        
        if (routeRequirements.fragile) {
            fit1 += profile1.skill_vector.fragile_handling;
            fit2 += profile2.skill_vector.fragile_handling;
            if (profile1.skill_vector.fragile_handling > profile2.skill_vector.fragile_handling) {
                reasons1.push('better fragile handling');
            } else {
                reasons2.push('better fragile handling');
            }
        }
        
        if (routeRequirements.urgent) {
            fit1 += profile1.skill_vector.urgency_handling;
            fit2 += profile2.skill_vector.urgency_handling;
            if (profile1.skill_vector.urgency_handling > profile2.skill_vector.urgency_handling) {
                reasons1.push('better urgency handling');
            } else {
                reasons2.push('better urgency handling');
            }
        }
        
        if (routeRequirements.night) {
            fit1 += profile1.skill_vector.night_driving;
            fit2 += profile2.skill_vector.night_driving;
            if (profile1.skill_vector.night_driving > profile2.skill_vector.night_driving) {
                reasons1.push('better night driving');
            } else {
                reasons2.push('better night driving');
            }
        }
        
        comparison.overall_fit = {
            driver1_fit_score: fit1,
            driver2_fit_score: fit2,
            recommended_driver: fit1 > fit2 ? profile1.rider_id : fit2 > fit1 ? profile2.rider_id : 'tie',
            driver1_reasons: reasons1,
            driver2_reasons: reasons2
        };
        
        comparison.recommendation = fit1 > fit2 
            ? `${profile1.rider_id} is better suited for this route type`
            : fit2 > fit1
            ? `${profile2.rider_id} is better suited for this route type`
            : 'Both drivers have similar suitability';
            
        comparison.explanation = `Based on route requirements, ${comparison.recommendation.toLowerCase()}. ` +
            (reasons1.length > 0 ? `${profile1.rider_id}: ${reasons1.join(', ')}. ` : '') +
            (reasons2.length > 0 ? `${profile2.rider_id}: ${reasons2.join(', ')}.` : '');
    }
    
    return comparison;
}

module.exports = {
    computeDriverSkillProfile,
    getDriverSkillProfile,
    compareDriverProfiles,
    // Expose helper functions for testing
    calculateConsistency,
    calculateStressRecovery,
    calculateProfileConfidence,
    calculateAverage
};
