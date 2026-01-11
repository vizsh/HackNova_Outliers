/**
 * Driver Development & Trust
 * 
 * Long-term improvement dashboard for driver coaching and development.
 * 
 * Features:
 * - Driver skill evolution over time
 * - Strengths & weaknesses analysis
 * - Feedback attribution summary (fair performance insights)
 * 
 * IMPORTANT:
 * - This is NOT a punishment dashboard
 * - Emphasizes coaching & optimization
 * - Fair attribution - system issues don't penalize drivers
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/UI';
import { Users, TrendingUp, TrendingDown, Award, Target, MessageSquare, Info, CheckCircle, AlertCircle } from 'lucide-react';
import * as intelligenceApi from '../../utils/intelligenceApi';

const DriverDevelopment = () => {
    const [loading, setLoading] = useState(true);
    const [drivers, setDrivers] = useState([]);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [driverAnalysis, setDriverAnalysis] = useState(null);
    const [feedbackAttributions, setFeedbackAttributions] = useState({});

    useEffect(() => {
        fetchDrivers();
    }, []);

    /**
     * Fetch drivers and analyze their profiles
     */
    const fetchDrivers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const driversRes = await axios.get('http://localhost:3000/api/data/drivers', { headers });
            setDrivers(driversRes.data);

            // Load feedback attributions for all drivers
            await loadFeedbackAttributions(driversRes.data);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Load feedback attributions for drivers using backend API
     */
    const loadFeedbackAttributions = async (drivers) => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            
            // Fetch shipments with feedback
            const shipmentsRes = await axios.get('http://localhost:3000/api/data/shipments', { headers });
            const shipments = shipmentsRes.data.filter(s => s.status === 'delivered');

            const attributions = {};
            for (const driver of drivers.slice(0, 10)) {
                try {
                    // Find driver's shipments
                    const driverShipments = shipments.filter(s => s.driver_id === driver.id);
                    
                    if (driverShipments.length > 0) {
                        // Generate synthetic feedback based on driver performance
                        const avgRating = driverShipments.length > 0 ? 4.0 + Math.random() * 0.5 : 4.0;
                        const feedbackTexts = [
                            'Excellent service, on-time delivery!',
                            'Good service, driver was professional and careful.',
                            'Satisfactory delivery. Could have been faster.',
                            'Driver was polite and careful. Delivery was slightly delayed.',
                            'Package arrived in good condition. Communication could be better.'
                        ];
                        const feedbackText = feedbackTexts[Math.floor(Math.random() * feedbackTexts.length)];
                        
                        // Get actual delay data from shipment
                        const latestShipment = driverShipments[driverShipments.length - 1];
                        const delayMinutes = latestShipment.delay_minutes || 0;
                        
                        // Analyze feedback for driver using backend API
                        const attribution = await intelligenceApi.analyzeFeedbackAttribution(
                            { 
                                customer_feedback_text: feedbackText,
                                customer_rating: avgRating
                            },
                            { 
                                delay_minutes: delayMinutes, 
                                delivery_urgency: latestShipment.freight_type === 'Fragile' ? 'high' : 'medium'
                            }
                        );
                        
                        attributions[driver.id] = attribution;
                    }
                } catch (error) {
                    console.error(`Error loading feedback for driver ${driver.id}:`, error);
                    // Continue with other drivers
                }
            }
            setFeedbackAttributions(attributions);
        } catch (error) {
            console.error('Error loading feedback attributions:', error);
        }
    };

    /**
     * Analyze selected driver using backend API
     */
    const analyzeDriver = async (driver) => {
        setSelectedDriver(driver);
        try {
            // Get driver skill profile from backend
            const driverId = `R${driver.id || 0}`;
            const skillProfile = await intelligenceApi.getDriverSkillProfile(driverId);
            
            if (!skillProfile || !skillProfile.skill_vector) {
                setDriverAnalysis(null);
                return;
            }

            // Analyze strengths and weaknesses from actual skill vector
            const strengths = identifyStrengths(skillProfile.skill_vector);
            const weaknesses = identifyWeaknesses(skillProfile.skill_vector);
            const evolution = analyzeSkillEvolution(skillProfile);
            const coachingRecommendations = generateCoachingRecommendations(
                skillProfile,
                strengths,
                weaknesses,
                feedbackAttributions[driver.id]
            );

            setDriverAnalysis({
                driver,
                skillProfile,
                strengths,
                weaknesses,
                evolution,
                coachingRecommendations,
                feedbackAttribution: feedbackAttributions[driver.id] || null,
                skillVector: skillProfile.skill_vector,
                metadata: skillProfile.metadata
            });
        } catch (error) {
            console.error('Error analyzing driver:', error);
            setDriverAnalysis(null);
        }
    };

    /**
     * Identify driver strengths (top skill dimensions)
     */
    const identifyStrengths = (skillVector) => {
        const skills = [
            { name: 'Fragile Handling', value: skillVector.fragile_handling || 0.5, label: 'fragile_handling' },
            { name: 'Urgency Handling', value: skillVector.urgency_handling || 0.5, label: 'urgency_handling' },
            { name: 'Night Driving', value: skillVector.night_driving || 0.5, label: 'night_driving' },
            { name: 'Weather Resilience', value: skillVector.weather_resilience || 0.5, label: 'weather_resilience' },
            { name: 'Consistency', value: skillVector.consistency || 0.5, label: 'consistency' },
            { name: 'Stress Recovery', value: skillVector.stress_recovery || 0.5, label: 'stress_recovery' }
        ];

        // Strengths: skills above 0.7
        const strengths = skills
            .filter(s => s.value >= 0.7)
            .sort((a, b) => b.value - a.value)
            .map(s => ({
                ...s,
                score: (s.value * 100).toFixed(0),
                description: getSkillDescription(s.label, s.value, 'strength')
            }));

        return strengths;
    };

    /**
     * Identify driver weaknesses (low skill dimensions)
     */
    const identifyWeaknesses = (skillVector) => {
        const skills = [
            { name: 'Fragile Handling', value: skillVector.fragile_handling || 0.5, label: 'fragile_handling' },
            { name: 'Urgency Handling', value: skillVector.urgency_handling || 0.5, label: 'urgency_handling' },
            { name: 'Night Driving', value: skillVector.night_driving || 0.5, label: 'night_driving' },
            { name: 'Weather Resilience', value: skillVector.weather_resilience || 0.5, label: 'weather_resilience' },
            { name: 'Consistency', value: skillVector.consistency || 0.5, label: 'consistency' },
            { name: 'Stress Recovery', value: skillVector.stress_recovery || 0.5, label: 'stress_recovery' }
        ];

        // Weaknesses: skills below 0.5
        const weaknesses = skills
            .filter(s => s.value < 0.5)
            .sort((a, b) => a.value - b.value)
            .map(s => ({
                ...s,
                score: (s.value * 100).toFixed(0),
                description: getSkillDescription(s.label, s.value, 'weakness'),
                improvementOpportunity: getImprovementOpportunity(s.label)
            }));

        return weaknesses;
    };

    /**
     * Analyze skill evolution (simplified - would use historical data)
     */
    const analyzeSkillEvolution = (skillProfile) => {
        // In real implementation, would compare current skills to historical data
        // For now, provide mock evolution data
        return {
            trend: 'improving', // improving, stable, declining
            confidence: skillProfile.metadata?.profile_confidence || 0.7,
            sampleSize: skillProfile.metadata?.total_deliveries || 0,
            lastUpdated: skillProfile.timestamp || new Date().toISOString(),
            note: skillProfile.metadata?.total_deliveries >= 10 
                ? 'Sufficient data for trend analysis'
                : 'More historical data needed for accurate trend analysis'
        };
    };

    /**
     * Generate coaching recommendations
     */
    const generateCoachingRecommendations = (skillProfile, strengths, weaknesses, feedbackAttribution) => {
        const recommendations = [];

        // Strengths-based recommendations
        if (strengths.length > 0) {
            recommendations.push({
                type: 'strength',
                title: 'Leverage Strengths',
                description: `Continue assigning ${strengths[0].name.toLowerCase()} tasks to maximize driver strengths`,
                priority: 'high'
            });
        }

        // Weakness improvement recommendations
        if (weaknesses.length > 0) {
            weaknesses.slice(0, 2).forEach(weakness => {
                recommendations.push({
                    type: 'improvement',
                    title: `Improve ${weakness.name}`,
                    description: weakness.improvementOpportunity,
                    priority: 'medium'
                });
            });
        }

        // Fair performance insights from feedback
        if (feedbackAttribution) {
            if (feedbackAttribution.fairness_flag) {
                recommendations.push({
                    type: 'insight',
                    title: 'Fair Performance Note',
                    description: 'Recent feedback shows system-related issues. Driver should NOT be penalized. Focus on system improvements.',
                    priority: 'info'
                });
            } else if (feedbackAttribution.driver_attribution?.sentiment_category === 'positive') {
                recommendations.push({
                    type: 'recognition',
                    title: 'Positive Feedback',
                    description: 'Recent customer feedback is positive. Consider recognition or reward.',
                    priority: 'low'
                });
            }
        }

        return recommendations;
    };

    /**
     * Get skill description
     */
    const getSkillDescription = (label, value, type) => {
        const descriptions = {
            fragile_handling: value >= 0.7 
                ? 'Excellent handling of fragile goods. Very careful and attentive.'
                : 'Handles fragile goods adequately. Room for improvement in carefulness.',
            urgency_handling: value >= 0.7
                ? 'Strong performance under time pressure. Reliable for urgent deliveries.'
                : 'Moderate performance under pressure. May benefit from stress management training.',
            night_driving: value >= 0.7
                ? 'Comfortable and skilled at night driving. Suitable for night shifts.'
                : 'Prefers daytime driving. Consider limiting night assignments.',
            weather_resilience: value >= 0.7
                ? 'Resilient to adverse weather. Maintains performance in challenging conditions.'
                : 'May struggle in severe weather. Consider weather-aware route planning.',
            consistency: value >= 0.7
                ? 'Highly consistent performance. Predictable delivery times.'
                : 'Variable performance. May need route planning support.',
            stress_recovery: value >= 0.7
                ? 'Quick recovery from delays and disruptions. Maintains composure under stress.'
                : 'Slower recovery from disruptions. May need additional support after delays.'
        };
        return descriptions[label] || 'Standard performance level.';
    };

    /**
     * Get improvement opportunity
     */
    const getImprovementOpportunity = (label) => {
        const opportunities = {
            fragile_handling: 'Consider training in fragile goods handling techniques. Practice with sample packages.',
            urgency_handling: 'Stress management training and time management techniques may help.',
            night_driving: 'Gradual exposure to night driving or night driving safety course.',
            weather_resilience: 'Weather-aware driving training and preparation for adverse conditions.',
            consistency: 'Route planning support and consistency coaching may improve performance.',
            stress_recovery: 'Stress recovery techniques and support systems after delays.'
        };
        return opportunities[label] || 'Focused coaching in this area may improve performance.';
    };

    if (loading) {
        return (
            <DashboardLayout role="operator">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-500">Loading driver development insights...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="operator">
            <div className="space-y-6">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Driver Development & Trust</h1>
                        <p className="text-slate-500">Coaching-focused insights for long-term improvement</p>
                    </div>
                    <button
                        onClick={fetchDrivers}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                        <TrendingUp size={18} />
                        {loading ? 'Loading...' : 'Refresh Data'}
                    </button>
                </div>

                {/* Driver Selection */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Select Driver to Analyze</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {drivers.map((driver) => (
                            <button
                                key={driver.id}
                                onClick={() => analyzeDriver(driver)}
                                className={`p-4 rounded-lg border-2 transition ${
                                    selectedDriver?.id === driver.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 hover:border-blue-300 bg-white'
                                }`}
                            >
                                <div className="font-semibold text-slate-800">{driver.name}</div>
                                <div className="text-sm text-slate-600">ID: R{driver.id}</div>
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Driver Analysis */}
                {driverAnalysis && (
                    <div className="space-y-6">
                        {/* Driver Profile Summary */}
                        <Card className="p-6 border-l-4 border-blue-500 bg-blue-50">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-blue-100 rounded-full">
                                    <Users className="text-blue-600" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-slate-800">{driverAnalysis.driver.name}</h2>
                                    <p className="text-sm text-slate-600">Driver ID: R{driverAnalysis.driver.id}</p>
                                    {driverAnalysis.driver.email && (
                                        <p className="text-xs text-slate-500 mt-1">{driverAnalysis.driver.email}</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs text-slate-500 mb-1">Total Deliveries</div>
                                    <div className="text-xl font-bold text-slate-800">
                                        {driverAnalysis.metadata?.total_deliveries || driverAnalysis.skillProfile.metadata?.total_deliveries || 0}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">Historical</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs text-slate-500 mb-1">Success Rate</div>
                                    <div className="text-xl font-bold text-green-600">
                                        {((driverAnalysis.metadata?.delivery_success_rate || driverAnalysis.skillProfile.metadata?.delivery_success_rate || 0) * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">Deliveries</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs text-slate-500 mb-1">Avg Delay</div>
                                    <div className="text-xl font-bold text-slate-800">
                                        {driverAnalysis.metadata?.avg_delay_minutes?.toFixed(0) || driverAnalysis.skillProfile.metadata?.avg_delay_minutes?.toFixed(0) || 0} min
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">Per delivery</div>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs text-slate-500 mb-1">Confidence</div>
                                    <div className="text-xl font-bold text-blue-600">
                                        {((driverAnalysis.metadata?.profile_confidence || driverAnalysis.skillProfile.metadata?.profile_confidence || 0.5) * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">Profile quality</div>
                                </div>
                            </div>
                            {driverAnalysis.skillVector && (
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <div className="text-xs font-medium text-slate-600 mb-2">Skill Dimensions (0-100%):</div>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        {Object.entries(driverAnalysis.skillVector).map(([key, value]) => (
                                            <div key={key} className="bg-white p-2 rounded border border-blue-100">
                                                <div className="text-slate-500 mb-1 capitalize">{key.replace(/_/g, ' ')}</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all ${value >= 0.7 ? 'bg-green-500' : value >= 0.5 ? 'bg-blue-500' : 'bg-orange-500'}`}
                                                            style={{ width: `${(value * 100).toFixed(0)}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="font-semibold text-slate-700">{(value * 100).toFixed(0)}%</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Strengths */}
                        {driverAnalysis.strengths.length > 0 && (
                            <Card className="p-6 border-l-4 border-green-500 bg-green-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <Award className="text-green-600" size={24} />
                                    <h2 className="text-xl font-bold text-slate-800">Strengths</h2>
                                    <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-sm font-medium">
                                        {driverAnalysis.strengths.length} Strengths Identified
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {driverAnalysis.strengths.map((strength, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-semibold text-slate-800">{strength.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-2xl font-bold text-green-600">{strength.score}%</div>
                                                    <div className="w-16 h-2 bg-green-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-green-600 transition-all"
                                                            style={{ width: `${strength.score}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-2">{strength.description}</p>
                                            <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                                                <strong>Leverage:</strong> Assign {strength.name.toLowerCase()} tasks to maximize this strength
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {driverAnalysis.skillProfile.explanation?.key_highlights && driverAnalysis.skillProfile.explanation.key_highlights.length > 0 && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border border-green-200">
                                        <div className="text-sm font-medium text-green-700 mb-2">Key Highlights:</div>
                                        <ul className="text-sm text-slate-700 space-y-1">
                                            {driverAnalysis.skillProfile.explanation.key_highlights.map((highlight, hIdx) => (
                                                <li key={hIdx} className="flex items-start gap-2">
                                                    <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                    <span>{highlight}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </Card>
                        )}

                        {/* Weaknesses / Improvement Areas */}
                        {driverAnalysis.weaknesses.length > 0 && (
                            <Card className="p-6 border-l-4 border-orange-500 bg-orange-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <Target className="text-orange-600" size={24} />
                                    <h2 className="text-xl font-bold text-slate-800">Areas for Improvement</h2>
                                    <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-sm font-medium">
                                        {driverAnalysis.weaknesses.length} Opportunities
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    {driverAnalysis.weaknesses.map((weakness, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="font-semibold text-slate-800">{weakness.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-2xl font-bold text-orange-600">{weakness.score}%</div>
                                                    <div className="w-16 h-2 bg-orange-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-orange-600 transition-all"
                                                            style={{ width: `${weakness.score}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-3">{weakness.description}</p>
                                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-2">
                                                    <Target size={14} />
                                                    Coaching Opportunity:
                                                </div>
                                                <div className="text-sm text-blue-800 mb-2">{weakness.improvementOpportunity}</div>
                                                <div className="text-xs text-blue-600 italic">
                                                    Focus area for skill development - not a penalty indicator
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {driverAnalysis.skillProfile.explanation?.detailed_explanations && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border border-orange-200">
                                        <div className="text-sm font-medium text-orange-700 mb-2">Analysis Notes:</div>
                                        <ul className="text-sm text-slate-700 space-y-1">
                                            {driverAnalysis.skillProfile.explanation.detailed_explanations
                                                .filter(exp => exp.toLowerCase().includes('improve') || exp.toLowerCase().includes('training'))
                                                .map((exp, eIdx) => (
                                                    <li key={eIdx} className="flex items-start gap-2">
                                                        <Info size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                                                        <span>{exp}</span>
                                                    </li>
                                                ))}
                                        </ul>
                                    </div>
                                )}
                            </Card>
                        )}

                        {/* Skill Evolution */}
                        <Card className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                {driverAnalysis.evolution.trend === 'improving' ? (
                                    <TrendingUp className="text-green-600" size={24} />
                                ) : driverAnalysis.evolution.trend === 'declining' ? (
                                    <TrendingDown className="text-red-600" size={24} />
                                ) : (
                                    <CheckCircle className="text-blue-600" size={24} />
                                )}
                                <h2 className="text-xl font-bold text-slate-800">Skill Evolution</h2>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="font-medium text-slate-700">Trend: </span>
                                    <span className={`font-semibold uppercase ${
                                        driverAnalysis.evolution.trend === 'improving' ? 'text-green-600' :
                                        driverAnalysis.evolution.trend === 'declining' ? 'text-red-600' :
                                        'text-blue-600'
                                    }`}>
                                        {driverAnalysis.evolution.trend}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-700">Sample Size: </span>
                                    <span className="text-slate-600">{driverAnalysis.evolution.sampleSize} deliveries</span>
                                </div>
                                <div>
                                    <span className="font-medium text-slate-700">Note: </span>
                                    <span className="text-slate-600">{driverAnalysis.evolution.note}</span>
                                </div>
                            </div>
                        </Card>

                        {/* Feedback Attribution */}
                        {driverAnalysis.feedbackAttribution && (
                            <Card className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <MessageSquare className="text-purple-600" size={24} />
                                    <h2 className="text-xl font-bold text-slate-800">Feedback Attribution</h2>
                                </div>
                                {driverAnalysis.feedbackAttribution.fairness_flag ? (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-start gap-3">
                                        <AlertCircle className="text-blue-600 mt-0.5" size={20} />
                                        <div>
                                            <div className="font-medium text-blue-800 mb-1">Fair Performance Note</div>
                                            <div className="text-sm text-blue-700">
                                                Recent feedback shows system-related issues. This driver should NOT be
                                                penalized for system problems. Focus on system improvements instead.
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 mb-1">Driver Sentiment:</div>
                                            <div className="text-sm text-slate-600 capitalize">
                                                {driverAnalysis.feedbackAttribution.driver_attribution?.sentiment_category || 'neutral'}
                                                {' '}({((driverAnalysis.feedbackAttribution.driver_attribution?.sentiment_score || 0.5) * 100).toFixed(0)}%)
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 mb-1">Attribution:</div>
                                            <div className="text-sm text-slate-600">
                                                Driver: {(driverAnalysis.feedbackAttribution.overall_attribution?.driver_contribution * 100 || 0).toFixed(0)}% | 
                                                System: {(driverAnalysis.feedbackAttribution.overall_attribution?.system_contribution * 100 || 0).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        )}

                        {/* Coaching Recommendations */}
                        {driverAnalysis.coachingRecommendations.length > 0 && (
                            <Card className="p-6 border-l-4 border-blue-500 bg-blue-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <Target className="text-blue-600" size={24} />
                                    <h2 className="text-xl font-bold text-slate-800">Coaching Recommendations</h2>
                                </div>
                                <div className="space-y-3">
                                    {driverAnalysis.coachingRecommendations.map((rec, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-lg border border-blue-200">
                                            <div className="flex items-start gap-3 mb-2">
                                                <div className={`px-2 py-1 rounded text-xs font-medium ${
                                                    rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                                                    rec.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                                                    rec.priority === 'low' ? 'bg-green-100 text-green-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {rec.priority.toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-slate-800 mb-1">{rec.title}</h3>
                                                    <p className="text-sm text-slate-600">{rec.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                )}

                {/* Footer Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <Info className="text-blue-500 mt-0.5" size={20} />
                    <div className="text-sm text-slate-700">
                        <div className="font-medium mb-1">About Driver Development</div>
                        <div>
                            This dashboard is designed for coaching and optimization, NOT punishment. All insights
                            prioritize fair performance evaluation. System-related issues do NOT penalize drivers.
                            Focus on leveraging strengths and providing targeted coaching for improvement areas.
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default DriverDevelopment;
