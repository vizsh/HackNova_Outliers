/**
 * Customer Feedback Attribution (NLP-light)
 * 
 * Processes customer feedback text to determine attribution:
 * - Driver-related sentiment (performance, behavior, skills)
 * - System-related issues (delays, routing, infrastructure)
 * 
 * DECISION-SUPPORT ONLY: Provides attribution analysis but does NOT automatically
 * penalize drivers for system faults. Attribution is stored separately for fairness.
 * 
 * IMPORTANT: Driver should NOT be penalized for system-related issues.
 * Attribution must be separate and fair.
 */

/**
 * Analyze customer feedback for attribution
 * 
 * @param {string} feedbackText - Customer feedback text
 * @param {Object} deliveryContext - Delivery context (delay, route issues, etc.)
 * @returns {Object} Attribution analysis with driver and system components
 */
function analyzeFeedbackAttribution(feedbackText, deliveryContext = {}) {
    if (!feedbackText || feedbackText.trim().length === 0) {
        return createEmptyAttribution('No feedback text provided');
    }
    
    const normalizedText = feedbackText.toLowerCase().trim();
    
    // Extract driver-related sentiment
    const driverSentiment = extractDriverSentiment(normalizedText);
    
    // Extract system-related issues
    const systemIssues = extractSystemIssues(normalizedText, deliveryContext);
    
    // Calculate overall attribution
    const attribution = calculateAttribution(driverSentiment, systemIssues);
    
    // Build explanation
    const explanation = buildAttributionExplanation(driverSentiment, systemIssues, attribution);
    
    // Generate recommendations
    const recommendations = generateAttributionRecommendations(attribution, driverSentiment, systemIssues);
    
    return {
        feedback_text: feedbackText,
        driver_attribution: driverSentiment,
        system_attribution: systemIssues,
        overall_attribution: attribution,
        explanation: explanation,
        recommendations: recommendations,
        fairness_flag: attribution.system_contribution > 0.5 ? 'SYSTEM_ISSUE' : null,
        timestamp: new Date().toISOString()
    };
}

/**
 * Extract driver-related sentiment from feedback
 * 
 * Identifies feedback about:
 * - Driver behavior (polite, rude, professional)
 * - Driver skills (careful handling, driving quality)
 * - Driver communication (informed customer, updates)
 * 
 * @param {string} normalizedText - Normalized feedback text (lowercase)
 * @returns {Object} Driver sentiment analysis
 */
function extractDriverSentiment(normalizedText) {
    // Driver behavior keywords (positive)
    const positiveBehaviorKeywords = [
        'polite', 'professional', 'courteous', 'friendly', 'helpful',
        'respectful', 'kind', 'nice', 'good', 'excellent', 'great'
    ];
    
    // Driver behavior keywords (negative)
    const negativeBehaviorKeywords = [
        'rude', 'impolite', 'unprofessional', 'disrespectful', 'bad attitude',
        'poor service', 'terrible', 'awful', 'horrible'
    ];
    
    // Driver skill keywords (positive)
    const positiveSkillKeywords = [
        'careful', 'handled well', 'handled carefully', 'skilled', 'experienced',
        'safe driving', 'good driving', 'expert', 'competent'
    ];
    
    // Driver skill keywords (negative)
    const negativeSkillKeywords = [
        'careless', 'rough handling', 'damaged', 'broken', 'poor handling',
        'bad driving', 'reckless', 'unsafe'
    ];
    
    // Communication keywords (positive)
    const positiveCommunicationKeywords = [
        'informed', 'communicated', 'updated', 'called', 'notified',
        'let me know', 'kept me informed', 'good communication'
    ];
    
    // Communication keywords (negative)
    const negativeCommunicationKeywords = [
        'no communication', 'did not call', 'no update', 'no notification',
        'poor communication', 'did not inform'
    ];
    
    // Count positive and negative mentions
    let positiveCount = 0;
    let negativeCount = 0;
    
    const checkKeywords = (keywords, isPositive) => {
        keywords.forEach(keyword => {
            if (normalizedText.includes(keyword)) {
                if (isPositive) positiveCount++;
                else negativeCount++;
            }
        });
    };
    
    checkKeywords(positiveBehaviorKeywords, true);
    checkKeywords(negativeBehaviorKeywords, false);
    checkKeywords(positiveSkillKeywords, true);
    checkKeywords(negativeSkillKeywords, false);
    checkKeywords(positiveCommunicationKeywords, true);
    checkKeywords(negativeCommunicationKeywords, false);
    
    // Calculate sentiment score (-1 to +1, then normalize to 0-1)
    const sentimentRaw = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1);
    const sentimentScore = (sentimentRaw + 1) / 2; // Normalize -1 to +1 → 0 to 1
    
    // Categorize sentiment
    let sentimentCategory = 'neutral';
    if (sentimentScore >= 0.7) sentimentCategory = 'positive';
    else if (sentimentScore >= 0.6) sentimentCategory = 'slightly_positive';
    else if (sentimentScore <= 0.3) sentimentCategory = 'negative';
    else if (sentimentScore <= 0.4) sentimentCategory = 'slightly_negative';
    
    // Extract specific aspects
    const aspects = {
        behavior: extractAspect(normalizedText, [...positiveBehaviorKeywords, ...negativeBehaviorKeywords]),
        skills: extractAspect(normalizedText, [...positiveSkillKeywords, ...negativeSkillKeywords]),
        communication: extractAspect(normalizedText, [...positiveCommunicationKeywords, ...negativeCommunicationKeywords])
    };
    
    return {
        sentiment_score: Math.round(sentimentScore * 100) / 100,
        sentiment_category: sentimentCategory,
        positive_mentions: positiveCount,
        negative_mentions: negativeCount,
        aspects: aspects,
        driver_related: (positiveCount + negativeCount) > 0
    };
}

/**
 * Extract system-related issues from feedback
 * 
 * Identifies feedback about:
 * - Delays (timing, late delivery)
 * - Routing issues (wrong address, inefficient route)
 * - Infrastructure issues (road conditions, traffic)
 * - Service issues (tracking, notification system)
 * 
 * @param {string} normalizedText - Normalized feedback text
 * @param {Object} deliveryContext - Delivery context (actual delays, route issues)
 * @returns {Object} System issues analysis
 */
function extractSystemIssues(normalizedText, deliveryContext = {}) {
    // Delay-related keywords (system issue, not driver fault)
    const delayKeywords = [
        'late', 'delayed', 'delay', 'took too long', 'slow delivery',
        'not on time', 'behind schedule', 'long time'
    ];
    
    // Routing issues
    const routingKeywords = [
        'wrong address', 'wrong location', 'wrong place', 'incorrect address',
        'long route', 'inefficient route', 'took longer route'
    ];
    
    // Infrastructure issues
    const infrastructureKeywords = [
        'traffic', 'road conditions', 'bad roads', 'construction',
        'weather', 'rain', 'storm', 'flood'
    ];
    
    // System/service issues
    const systemKeywords = [
        'tracking', 'notification', 'update system', 'app issue',
        'website problem', 'system error', 'technical issue'
    ];
    
    let delayMentions = 0;
    let routingMentions = 0;
    let infrastructureMentions = 0;
    let systemMentions = 0;
    
    delayKeywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) delayMentions++;
    });
    
    routingKeywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) routingMentions++;
    });
    
    infrastructureKeywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) infrastructureMentions++;
    });
    
    systemKeywords.forEach(keyword => {
        if (normalizedText.includes(keyword)) systemMentions++;
    });
    
    // Check delivery context for actual delays
    const actualDelayMinutes = parseFloat(deliveryContext.delay_minutes) || 0;
    const hasActualDelay = actualDelayMinutes > 15; // Significant delay (>15 min)
    
    // If actual delay exists and feedback mentions delay, it's likely system-related
    if (hasActualDelay && delayMentions > 0) {
        delayMentions += 2; // Boost weight for actual delays
    }
    
    const totalSystemIssues = delayMentions + routingMentions + infrastructureMentions + systemMentions;
    
    // Calculate system issue score (0-1)
    // Normalize by total possible mentions (cap at 1.0)
    const systemIssueScore = Math.min(1.0, totalSystemIssues / 5);
    
    // Categorize system contribution
    let systemCategory = 'none';
    if (systemIssueScore >= 0.6) systemCategory = 'major';
    else if (systemIssueScore >= 0.3) systemCategory = 'moderate';
    else if (systemIssueScore > 0) systemCategory = 'minor';
    
    return {
        system_issue_score: Math.round(systemIssueScore * 100) / 100,
        system_category: systemCategory,
        issue_breakdown: {
            delays: delayMentions,
            routing: routingMentions,
            infrastructure: infrastructureMentions,
            system_service: systemMentions
        },
        has_actual_delay: hasActualDelay,
        actual_delay_minutes: actualDelayMinutes,
        system_related: totalSystemIssues > 0 || hasActualDelay
    };
}

/**
 * Extract specific aspect from text
 * 
 * @param {string} text - Normalized text
 * @param {Array<string>} keywords - Keywords to search for
 * @returns {Object} Aspect analysis
 */
function extractAspect(text, keywords) {
    const found = [];
    keywords.forEach(keyword => {
        if (text.includes(keyword)) {
            found.push(keyword);
        }
    });
    
    return {
        mentioned: found.length > 0,
        keywords_found: found,
        count: found.length
    };
}

/**
 * Calculate overall attribution between driver and system
 * 
 * IMPORTANT: This determines whether feedback is primarily driver-related
 * or system-related. System issues should NOT penalize driver.
 * 
 * @param {Object} driverSentiment - Driver sentiment analysis
 * @param {Object} systemIssues - System issues analysis
 * @returns {Object} Attribution breakdown
 */
function calculateAttribution(driverSentiment, systemIssues) {
    // Weight driver sentiment (if driver-related feedback exists)
    const driverWeight = driverSentiment.driver_related ? driverSentiment.sentiment_score : 0;
    
    // Weight system issues (if system-related issues exist)
    const systemWeight = systemIssues.system_related ? systemIssues.system_issue_score : 0;
    
    // Normalize weights to determine primary attribution
    const totalWeight = driverWeight + systemWeight;
    
    let driverContribution = 0;
    let systemContribution = 0;
    
    if (totalWeight > 0) {
        driverContribution = driverWeight / totalWeight;
        systemContribution = systemWeight / totalWeight;
    } else {
        // No clear attribution, default to neutral
        driverContribution = 0.5;
        systemContribution = 0.5;
    }
    
    // Determine primary attribution
    let primaryAttribution = 'mixed';
    if (driverContribution > 0.7) primaryAttribution = 'driver';
    else if (systemContribution > 0.7) primaryAttribution = 'system';
    else if (driverContribution > 0.5) primaryAttribution = 'driver_primary';
    else if (systemContribution > 0.5) primaryAttribution = 'system_primary';
    
    // Fairness flag: If system issues are major, driver should not be penalized
    const fairnessFlag = systemIssues.system_category === 'major' || systemIssues.has_actual_delay;
    
    return {
        driver_contribution: Math.round(driverContribution * 100) / 100,
        system_contribution: Math.round(systemContribution * 100) / 100,
        primary_attribution: primaryAttribution,
        fairness_flag: fairnessFlag,
        should_penalize_driver: primaryAttribution === 'driver' && !fairnessFlag,
        explanation: buildAttributionText(driverContribution, systemContribution, primaryAttribution, fairnessFlag)
    };
}

/**
 * Build attribution explanation text
 */
function buildAttributionText(driverContribution, systemContribution, primaryAttribution, fairnessFlag) {
    if (fairnessFlag) {
        return 'Major system issues or delays detected. Driver should NOT be penalized.';
    }
    
    if (primaryAttribution === 'driver') {
        return `Feedback is primarily driver-related (${(driverContribution * 100).toFixed(0)}%). Driver performance feedback applicable.`;
    } else if (primaryAttribution === 'system') {
        return `Feedback is primarily system-related (${(systemContribution * 100).toFixed(0)}%). Driver should NOT be penalized.`;
    } else {
        return `Feedback has mixed attribution. Driver: ${(driverContribution * 100).toFixed(0)}%, System: ${(systemContribution * 100).toFixed(0)}%. Review carefully.`;
    }
}

/**
 * Build attribution explanation object
 */
function buildAttributionExplanation(driverSentiment, systemIssues, attribution) {
    return {
        summary: attribution.explanation,
        driver_sentiment_summary: `Driver sentiment: ${driverSentiment.sentiment_category} (${(driverSentiment.sentiment_score * 100).toFixed(0)}/100)`,
        system_issues_summary: systemIssues.system_related 
            ? `System issues: ${systemIssues.system_category} (${(systemIssues.system_issue_score * 100).toFixed(0)}/100)`
            : 'No significant system issues identified',
        attribution_breakdown: {
            driver: `${(attribution.driver_contribution * 100).toFixed(0)}% driver-related`,
            system: `${(attribution.system_contribution * 100).toFixed(0)}% system-related`
        },
        fairness_note: attribution.fairness_flag 
            ? '⚠ FAIRNESS: Major system issues detected. Driver should NOT be penalized for system-related problems.'
            : 'Feedback attribution is fair and can be applied to driver performance evaluation.'
    };
}

/**
 * Generate attribution recommendations
 */
function generateAttributionRecommendations(attribution, driverSentiment, systemIssues) {
    const recommendations = [];
    
    if (attribution.fairness_flag) {
        recommendations.push('⚠ FAIRNESS ALERT: Do NOT penalize driver for system-related issues');
        recommendations.push('System issues or delays detected. Focus on system improvements, not driver penalties.');
    }
    
    if (attribution.primary_attribution === 'driver' && !attribution.fairness_flag) {
        if (driverSentiment.sentiment_category === 'positive') {
            recommendations.push('✓ Positive driver feedback - consider recognition or reward');
            recommendations.push('Use as positive reinforcement for driver performance');
        } else if (driverSentiment.sentiment_category === 'negative') {
            recommendations.push('⚠ Negative driver feedback - consider training or coaching');
            recommendations.push('Review specific aspects: ' + Object.keys(driverSentiment.aspects)
                .filter(key => driverSentiment.aspects[key].mentioned)
                .join(', '));
        }
    }
    
    if (systemIssues.system_related) {
        recommendations.push('System issues identified. Investigate and improve:');
        if (systemIssues.issue_breakdown.delays > 0) {
            recommendations.push('  - Delivery delays: Review routing and time estimates');
        }
        if (systemIssues.issue_breakdown.routing > 0) {
            recommendations.push('  - Routing issues: Review address verification and route optimization');
        }
        if (systemIssues.issue_breakdown.infrastructure > 0) {
            recommendations.push('  - Infrastructure issues: Account for traffic and weather in planning');
        }
        if (systemIssues.issue_breakdown.system_service > 0) {
            recommendations.push('  - System/service issues: Review tracking and notification systems');
        }
    }
    
    return recommendations;
}

/**
 * Create empty attribution when no feedback
 */
function createEmptyAttribution(reason) {
    return {
        feedback_text: '',
        driver_attribution: {
            sentiment_score: 0.5,
            sentiment_category: 'neutral',
            positive_mentions: 0,
            negative_mentions: 0,
            aspects: { behavior: { mentioned: false }, skills: { mentioned: false }, communication: { mentioned: false } },
            driver_related: false
        },
        system_attribution: {
            system_issue_score: 0,
            system_category: 'none',
            issue_breakdown: { delays: 0, routing: 0, infrastructure: 0, system_service: 0 },
            has_actual_delay: false,
            actual_delay_minutes: 0,
            system_related: false
        },
        overall_attribution: {
            driver_contribution: 0.5,
            system_contribution: 0.5,
            primary_attribution: 'mixed',
            fairness_flag: false,
            should_penalize_driver: false,
            explanation: reason
        },
        explanation: { summary: reason },
        recommendations: [],
        fairness_flag: null,
        timestamp: new Date().toISOString()
    };
}

/**
 * Batch analyze feedback attributions
 * 
 * @param {Array<Object>} feedbacks - Array of feedback objects
 * @returns {Array} Array of attribution analyses
 */
function analyzeBatchFeedback(feedbacks) {
    return feedbacks.map(feedback => ({
        feedback_id: feedback.id || feedback.shipment_id || 'unknown',
        attribution: analyzeFeedbackAttribution(
            feedback.customer_feedback_text || feedback.comment || '',
            {
                delay_minutes: feedback.delay_minutes || 0,
                delivery_urgency: feedback.delivery_urgency || 'medium'
            }
        )
    }));
}

module.exports = {
    analyzeFeedbackAttribution,
    analyzeBatchFeedback,
    // Expose helper functions for testing
    extractDriverSentiment,
    extractSystemIssues,
    calculateAttribution
};
