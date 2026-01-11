/**
 * Route Difficulty & Risk Analyzer
 * 
 * Analyzes route characteristics and computes risk scores for decision support.
 * 
 * DECISION-SUPPORT ONLY: Provides risk assessment but does NOT auto-reject routes.
 * All risk factors are preserved separately for explainability.
 * 
 * IMPORTANT: Risk scores are normalized and explainable. Operators can see
 * which factors contribute most to risk.
 */

/**
 * Analyze route difficulty and risk for a delivery
 * 
 * @param {Object} deliveryRecord - Delivery record from dataset or new delivery request
 * @returns {Object} Route risk analysis with explainable breakdown
 */
function analyzeRouteRisk(deliveryRecord) {
    // Extract risk factors from delivery record
    const routeDifficulty = parseFloat(deliveryRecord.route_difficulty_score) || 0.5;
    const trafficVolatility = parseFloat(deliveryRecord.traffic_volatility) || 0.5;
    const weatherSeverity = parseFloat(deliveryRecord.weather_severity) || 0.0;
    const deliveryUrgency = deliveryRecord.delivery_urgency || 'medium';
    
    // Normalize route difficulty (already 0-1, but ensure it's in range)
    const normalizedDifficulty = Math.max(0, Math.min(1, routeDifficulty));
    
    // Compute risk contribution from each factor
    const riskContributors = computeRiskContributors({
        route_difficulty: normalizedDifficulty,
        traffic_volatility: trafficVolatility,
        weather_severity: weatherSeverity,
        delivery_urgency: deliveryUrgency
    });
    
    // Calculate overall route risk score (0-1, higher = more risky)
    const routeRiskScore = calculateRouteRiskScore(riskContributors);
    
    // Identify key risk contributors (for explanation)
    const keyContributors = identifyKeyContributors(riskContributors);
    
    // Build explainable risk assessment
    const explanation = buildRiskExplanation(riskContributors, routeRiskScore, keyContributors);
    
    // Categorize risk level
    const riskLevel = categorizeRiskLevel(routeRiskScore);
    
    return {
        route_risk_score: routeRiskScore,
        risk_level: riskLevel,
        normalized_difficulty: normalizedDifficulty,
        risk_contributors: riskContributors,
        key_contributors: keyContributors,
        explanation: explanation,
        recommendations: generateRiskRecommendations(riskContributors, routeRiskScore),
        timestamp: new Date().toISOString()
    };
}

/**
 * Compute risk contribution from each factor
 * 
 * Each factor contributes differently to overall risk:
 * - Route difficulty: Base risk factor
 * - Traffic volatility: Multiplicative risk (amplifies difficulty)
 * - Weather severity: Additive risk (additional challenge)
 * - Delivery urgency: Modifier (higher urgency = higher risk tolerance needed)
 * 
 * @param {Object} factors - Risk factors object
 * @returns {Object} Risk contributors with individual contributions
 */
function computeRiskContributors(factors) {
    const {
        route_difficulty,
        traffic_volatility,
        weather_severity,
        delivery_urgency
    } = factors;
    
    // Base risk from route difficulty
    const baseRisk = route_difficulty * 0.4; // 40% weight for base difficulty
    
    // Traffic volatility amplifies base risk (multiplicative)
    const trafficImpact = baseRisk * traffic_volatility * 0.3; // 30% weight, amplifies base
    
    // Weather severity adds independent risk (additive)
    const weatherImpact = weather_severity * 0.2; // 20% weight, independent
    
    // Delivery urgency modifies risk (higher urgency requires more capability)
    // Urgency doesn't increase route risk itself, but increases required driver capability
    const urgencyModifier = getUrgencyModifier(delivery_urgency);
    const urgencyImpact = baseRisk * urgencyModifier * 0.1; // 10% weight
    
    // Calculate individual contributions (normalized to 0-1 for explanation)
    const totalContributableRisk = baseRisk + trafficImpact + weatherImpact + urgencyImpact;
    
    return {
        route_difficulty: {
            raw_score: route_difficulty,
            contribution: baseRisk,
            contribution_percentage: (baseRisk / Math.max(totalContributableRisk, 0.001)) * 100,
            impact: categorizeImpact(baseRisk)
        },
        traffic_volatility: {
            raw_score: traffic_volatility,
            contribution: trafficImpact,
            contribution_percentage: (trafficImpact / Math.max(totalContributableRisk, 0.001)) * 100,
            impact: categorizeImpact(trafficImpact)
        },
        weather_severity: {
            raw_score: weather_severity,
            contribution: weatherImpact,
            contribution_percentage: (weatherImpact / Math.max(totalContributableRisk, 0.001)) * 100,
            impact: categorizeImpact(weatherImpact)
        },
        delivery_urgency: {
            raw_value: delivery_urgency,
            modifier: urgencyModifier,
            contribution: urgencyImpact,
            contribution_percentage: (urgencyImpact / Math.max(totalContributableRisk, 0.001)) * 100,
            impact: categorizeImpact(urgencyImpact)
        }
    };
}

/**
 * Get urgency modifier value
 * 
 * Higher urgency doesn't make route riskier, but requires more capable driver
 * 
 * @param {string} urgency - Delivery urgency (low/medium/high)
 * @returns {number} Modifier value
 */
function getUrgencyModifier(urgency) {
    const modifiers = {
        'low': 0.5,      // Low urgency = less critical
        'medium': 1.0,   // Medium urgency = standard
        'high': 1.5      // High urgency = requires exceptional capability
    };
    
    return modifiers[urgency?.toLowerCase()] || 1.0;
}

/**
 * Calculate overall route risk score
 * 
 * Combines all risk contributors into a single normalized score (0-1)
 * 
 * @param {Object} riskContributors - Risk contributors object
 * @returns {number} Overall route risk score (0-1)
 */
function calculateRouteRiskScore(riskContributors) {
    // Sum all contributions (already weighted)
    const totalRisk = 
        riskContributors.route_difficulty.contribution +
        riskContributors.traffic_volatility.contribution +
        riskContributors.weather_severity.contribution +
        riskContributors.delivery_urgency.contribution;
    
    // Normalize to 0-1 range (theoretical max is 1.0 based on weights)
    const normalizedRisk = Math.max(0, Math.min(1, totalRisk));
    
    return Math.round(normalizedRisk * 100) / 100; // Round to 2 decimals
}

/**
 * Identify key risk contributors (top contributors)
 * 
 * @param {Object} riskContributors - Risk contributors object
 * @returns {Array} Array of key contributors sorted by contribution
 */
function identifyKeyContributors(riskContributors) {
    const contributors = [
        { factor: 'route_difficulty', ...riskContributors.route_difficulty },
        { factor: 'traffic_volatility', ...riskContributors.traffic_volatility },
        { factor: 'weather_severity', ...riskContributors.weather_severity },
        { factor: 'delivery_urgency', ...riskContributors.delivery_urgency }
    ];
    
    // Sort by contribution (descending)
    contributors.sort((a, b) => b.contribution - a.contribution);
    
    // Return top contributors (those contributing > 15% of total risk)
    return contributors.filter(c => c.contribution_percentage > 15)
        .map(c => ({
            factor: c.factor,
            contribution_percentage: Math.round(c.contribution_percentage),
            raw_score: c.raw_score || c.raw_value,
            impact: c.impact
        }));
}

/**
 * Categorize risk impact level
 * 
 * @param {number} contribution - Risk contribution value
 * @returns {string} Impact level (low/medium/high)
 */
function categorizeImpact(contribution) {
    if (contribution >= 0.3) return 'high';
    if (contribution >= 0.15) return 'medium';
    return 'low';
}

/**
 * Categorize overall risk level
 * 
 * @param {number} riskScore - Overall route risk score (0-1)
 * @returns {string} Risk level (low/medium/high/critical)
 */
function categorizeRiskLevel(riskScore) {
    if (riskScore >= 0.75) return 'critical';
    if (riskScore >= 0.5) return 'high';
    if (riskScore >= 0.25) return 'medium';
    return 'low';
}

/**
 * Build human-readable risk explanation
 * 
 * @param {Object} riskContributors - Risk contributors object
 * @param {number} routeRiskScore - Overall risk score
 * @param {Array} keyContributors - Key contributors array
 * @returns {Object} Explanation object
 */
function buildRiskExplanation(riskContributors, routeRiskScore, keyContributors) {
    const riskLevel = categorizeRiskLevel(routeRiskScore);
    
    let summary = `Route risk assessment: ${riskLevel.toUpperCase()} risk (${(routeRiskScore * 100).toFixed(1)}%)`;
    
    if (keyContributors.length > 0) {
        summary += `. Primary risk factors: ${keyContributors.map(c => c.factor.replace(/_/g, ' ')).join(', ')}.`;
    }
    
    const details = [];
    
    if (riskContributors.route_difficulty.contribution > 0.2) {
        details.push(`Route difficulty is ${categorizeImpact(riskContributors.route_difficulty.contribution)} (${riskContributors.route_difficulty.raw_score.toFixed(2)}/1.0)`);
    }
    
    if (riskContributors.traffic_volatility.contribution > 0.15) {
        details.push(`Traffic volatility is ${categorizeImpact(riskContributors.traffic_volatility.contribution)} (${riskContributors.traffic_volatility.raw_score.toFixed(2)}/1.0)`);
    }
    
    if (riskContributors.weather_severity.contribution > 0.1) {
        details.push(`Weather severity is ${categorizeImpact(riskContributors.weather_severity.contribution)} (${riskContributors.weather_severity.raw_score.toFixed(2)}/1.0)`);
    }
    
    if (riskContributors.delivery_urgency.raw_value === 'high') {
        details.push(`High urgency delivery requires exceptional driver capability`);
    }
    
    return {
        summary: summary,
        detailed_breakdown: details,
        risk_score_interpretation: {
            low: 'Low risk (0-0.25): Standard route, typical challenges',
            medium: 'Medium risk (0.25-0.5): Moderate challenges, capable driver recommended',
            high: 'High risk (0.5-0.75): Significant challenges, experienced driver recommended',
            critical: 'Critical risk (0.75-1.0): Extreme challenges, elite driver recommended or route review needed'
        },
        contributor_breakdown: riskContributors
    };
}

/**
 * Generate risk-based recommendations
 * 
 * DECISION-SUPPORT: Provides recommendations but does NOT enforce them
 * 
 * @param {Object} riskContributors - Risk contributors object
 * @param {number} routeRiskScore - Overall risk score
 * @returns {Array} Array of recommendation strings
 */
function generateRiskRecommendations(riskContributors, routeRiskScore) {
    const recommendations = [];
    
    if (routeRiskScore >= 0.75) {
        recommendations.push('CRITICAL: Consider route review or alternative route');
        recommendations.push('Assign only elite/experienced drivers');
        recommendations.push('Enable real-time tracking and monitoring');
    } else if (routeRiskScore >= 0.5) {
        recommendations.push('Assign experienced driver with strong skill profile');
        recommendations.push('Monitor delivery progress closely');
        recommendations.push('Consider buffer time in ETA estimates');
    } else if (routeRiskScore >= 0.25) {
        recommendations.push('Standard route - assign capable driver');
        recommendations.push('Monitor for any unusual delays');
    } else {
        recommendations.push('Low risk route - standard assignment protocol');
    }
    
    // Specific recommendations based on contributors
    if (riskContributors.weather_severity.raw_score > 0.7) {
        recommendations.push('Ensure driver has high weather resilience skill');
    }
    
    if (riskContributors.traffic_volatility.raw_score > 0.7) {
        recommendations.push('Consider traffic-aware route optimization');
        recommendations.push('Driver with good stress recovery preferred');
    }
    
    if (riskContributors.delivery_urgency.raw_value === 'high') {
        recommendations.push('Ensure driver has strong urgency handling capability');
        recommendations.push('High urgency: prioritize experienced drivers');
    }
    
    return recommendations;
}

/**
 * Compare risk between multiple routes
 * 
 * DECISION-SUPPORT: Helps operators compare route risks
 * 
 * @param {Array<Object>} routeAnalyses - Array of route risk analyses
 * @returns {Object} Comparison result
 */
function compareRouteRisks(routeAnalyses) {
    if (routeAnalyses.length < 2) {
        return { error: 'Need at least 2 routes to compare' };
    }
    
    // Sort by risk score (ascending - lower risk first)
    const sorted = [...routeAnalyses].sort((a, b) => a.route_risk_score - b.route_risk_score);
    
    const comparison = {
        total_routes: routeAnalyses.length,
        lowest_risk: sorted[0],
        highest_risk: sorted[sorted.length - 1],
        risk_difference: sorted[sorted.length - 1].route_risk_score - sorted[0].route_risk_score,
        recommendation: '',
        explanation: ''
    };
    
    if (comparison.risk_difference > 0.2) {
        comparison.recommendation = `Significant risk difference detected (${(comparison.risk_difference * 100).toFixed(1)}%). Consider lower risk route if possible.`;
    } else if (comparison.risk_difference > 0.1) {
        comparison.recommendation = `Moderate risk difference (${(comparison.risk_difference * 100).toFixed(1)}%). Both routes viable with appropriate driver selection.`;
    } else {
        comparison.recommendation = 'Routes have similar risk levels. Driver selection more critical than route selection.';
    }
    
    comparison.explanation = `Route risk comparison: ${sorted.length} routes analyzed. ` +
        `Lowest risk: ${comparison.lowest_risk.risk_level} (${(comparison.lowest_risk.route_risk_score * 100).toFixed(1)}%). ` +
        `Highest risk: ${comparison.highest_risk.risk_level} (${(comparison.highest_risk.route_risk_score * 100).toFixed(1)}%).`;
    
    return comparison;
}

module.exports = {
    analyzeRouteRisk,
    compareRouteRisks,
    // Expose helper functions for testing
    calculateRouteRiskScore,
    categorizeRiskLevel,
    computeRiskContributors
};
