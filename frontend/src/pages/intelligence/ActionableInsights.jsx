/**
 * Actionable Insights Panel
 * 
 * Shows operators WHAT to do and WHY based on intelligence analysis.
 * 
 * Features:
 * - High Risk Deliveries Today
 * - Drivers Best Suited for Urgent Jobs
 * - Routes with Unusual Risk Today
 * - Drivers Showing Fatigue or Stress Patterns
 * 
 * All insights include: reason, confidence level, suggested action (not forced)
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/UI';
import { AlertTriangle, Users, MapPin, Activity, TrendingUp, Info, CheckCircle, X } from 'lucide-react';
import MapComponent from '../../components/MapComponent';
import * as intelligenceApi from '../../utils/intelligenceApi';

const ActionableInsights = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState({
        highRiskDeliveries: [],
        driversForUrgentJobs: [],
        unusualRiskRoutes: [],
        fatigueStressDrivers: []
    });
    const [selectedRouteDetail, setSelectedRouteDetail] = useState(null);
    const [selectedDevelopmentPlan, setSelectedDevelopmentPlan] = useState(null);

    useEffect(() => {
        fetchInsights();
    }, []);

    /**
     * Fetch all actionable insights from intelligence modules
     * Reads from intelligence API, does NOT re-compute logic
     */
    const fetchInsights = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch active shipments
            const shipmentsRes = await axios.get('http://localhost:3000/api/data/shipments', { headers });
            const shipments = shipmentsRes.data.filter(s => s.status === 'in_transit' || s.status === 'pending');

            // Fetch drivers
            const driversRes = await axios.get('http://localhost:3000/api/data/drivers', { headers });
            const drivers = driversRes.data;

            // 1. High Risk Deliveries Today
            const highRiskDeliveries = await analyzeHighRiskDeliveries(shipments);

            // 2. Drivers Best Suited for Urgent Jobs
            const driversForUrgentJobs = await findDriversForUrgentJobs(drivers, shipments);

            // 3. Routes with Unusual Risk Today
            const unusualRiskRoutes = await findUnusualRiskRoutes(shipments);

            // 4. Drivers Showing Fatigue or Stress Patterns
            const fatigueStressDrivers = await identifyFatigueStressDrivers(drivers);

            setInsights({
                highRiskDeliveries,
                driversForUrgentJobs,
                unusualRiskRoutes,
                fatigueStressDrivers
            });
        } catch (error) {
            console.error('Error fetching insights:', error);
            // Set empty insights with error message
            setInsights({
                highRiskDeliveries: [],
                driversForUrgentJobs: [],
                unusualRiskRoutes: [],
                fatigueStressDrivers: [],
                error: error.response?.data?.error || 'Failed to load insights. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Analyze high-risk deliveries using route risk analysis
     * Uses backend API with shipmentId to get enriched data
     */
    const analyzeHighRiskDeliveries = async (shipments) => {
        const highRisk = [];
        for (const shipment of shipments.slice(0, 20)) { // Limit to first 20 for performance
            try {
                // Call backend API with shipmentId to get enriched route analysis
                const routeAnalysis = await intelligenceApi.analyzeRouteRisk(null, shipment.id || shipment.tracking_number);
                
                // Only include high/critical risk deliveries
                if (routeAnalysis.risk_level === 'high' || routeAnalysis.risk_level === 'critical') {
                    highRisk.push({
                        shipment,
                        routeAnalysis,
                        reason: routeAnalysis.explanation?.summary || 'High route risk detected',
                        confidence: routeAnalysis.key_contributors?.length > 0 ? 0.8 : 0.6,
                        suggestedAction: getSuggestedAction(routeAnalysis),
                        keyContributors: routeAnalysis.key_contributors || [],
                        riskScore: routeAnalysis.route_risk_score
                    });
                }
            } catch (error) {
                console.error(`Error analyzing shipment ${shipment.id}:`, error);
                // Continue with other shipments even if one fails
            }
        }
        return highRisk;
    };

    /**
     * Find drivers best suited for urgent jobs using driver-route fit
     * Uses backend API to get real skill profiles
     */
    const findDriversForUrgentJobs = async (drivers, shipments) => {
        const urgentShipments = shipments.filter(s => s.freight_type === 'Fragile' || s.status === 'pending');
        if (urgentShipments.length === 0) return [];

        const suitableDrivers = [];
        for (const driver of drivers.slice(0, 10)) { // Limit for performance
            try {
                // Get driver skill profile from backend
                const driverId = `R${driver.id || 0}`; // Convert to rider_id format
                const skillProfile = await intelligenceApi.getDriverSkillProfile(driverId);
                
                if (!skillProfile || !skillProfile.skill_vector) continue;

                // Check if driver is suitable for urgent jobs
                const urgencyHandling = skillProfile.skill_vector.urgency_handling || 0.5;
                const stressRecovery = skillProfile.skill_vector.stress_recovery || 0.5;
                const overallScore = (urgencyHandling + stressRecovery) / 2;

                if (overallScore >= 0.65) {
                    suitableDrivers.push({
                        driver,
                        skillProfile,
                        urgencyScore: urgencyHandling,
                        stressRecoveryScore: stressRecovery,
                        reason: skillProfile.explanation?.summary || `Strong urgency handling (${(urgencyHandling * 100).toFixed(0)}%) and stress recovery (${(stressRecovery * 100).toFixed(0)}%)`,
                        confidence: skillProfile.metadata?.profile_confidence || 0.7,
                        suggestedAction: skillProfile.explanation?.key_highlights?.join(', ') || `Consider for urgent/fragile deliveries`,
                        skillVector: skillProfile.skill_vector
                    });
                }
            } catch (error) {
                console.error(`Error analyzing driver ${driver.id}:`, error);
                // Continue with other drivers even if one fails
            }
        }

        // Sort by urgency score
        return suitableDrivers.sort((a, b) => b.urgencyScore - a.urgencyScore).slice(0, 5);
    };

    /**
     * Find routes with unusual risk using route risk analysis
     * Uses backend API with shipmentId to get enriched data
     */
    const findUnusualRiskRoutes = async (shipments) => {
        const routes = [];
        for (const shipment of shipments.slice(0, 15)) {
            try {
                // Call backend API with shipmentId
                const routeAnalysis = await intelligenceApi.analyzeRouteRisk(null, shipment.id || shipment.tracking_number);
                
                // Unusual risk = high risk or multiple unexpected contributors
                if (routeAnalysis.risk_level === 'high' || routeAnalysis.risk_level === 'critical' ||
                    (routeAnalysis.key_contributors && routeAnalysis.key_contributors.length > 2)) {
                    routes.push({
                        shipment,
                        routeAnalysis,
                        reason: routeAnalysis.explanation?.summary || `Multiple risk contributors: ${routeAnalysis.key_contributors?.map(c => c.factor.replace(/_/g, ' ')).join(', ') || 'High route risk'}`,
                        confidence: routeAnalysis.key_contributors?.length > 0 ? 0.85 : 0.7,
                        suggestedAction: routeAnalysis.recommendations?.[0] || 'Review route and consider alternatives',
                        riskContributors: routeAnalysis.key_contributors || []
                    });
                }
            } catch (error) {
                console.error(`Error analyzing route for shipment ${shipment.id}:`, error);
                // Continue with other shipments
            }
        }
        return routes;
    };

    /**
     * Identify drivers showing fatigue or stress patterns
     * Uses backend API to get real skill profiles
     */
    const identifyFatigueStressDrivers = async (drivers) => {
        const fatiguedDrivers = [];
        for (const driver of drivers.slice(0, 10)) {
            try {
                const driverId = `R${driver.id || 0}`;
                const skillProfile = await intelligenceApi.getDriverSkillProfile(driverId);
                
                if (!skillProfile || !skillProfile.skill_vector) continue;

                // Check for low stress recovery or consistency (potential fatigue indicators)
                const stressRecovery = skillProfile.skill_vector.stress_recovery || 0.5;
                const consistency = skillProfile.skill_vector.consistency || 0.5;
                const totalDeliveries = skillProfile.metadata?.total_deliveries || 0;
                const avgDelay = skillProfile.metadata?.avg_delay_minutes || 0;

                // Flag if stress recovery or consistency is low, or high average delay
                if (stressRecovery < 0.5 || consistency < 0.5 || avgDelay > 30) {
                    fatiguedDrivers.push({
                        driver,
                        skillProfile,
                        stressRecovery,
                        consistency,
                        avgDelay,
                        totalDeliveries,
                        reason: stressRecovery < 0.5 
                            ? `Low stress recovery (${(stressRecovery * 100).toFixed(0)}%) - may need recovery time. Avg delay: ${avgDelay.toFixed(1)} min`
                            : consistency < 0.5
                            ? `Low consistency (${(consistency * 100).toFixed(0)}%) - variable performance. Avg delay: ${avgDelay.toFixed(1)} min`
                            : `High average delay (${avgDelay.toFixed(1)} min) - possible fatigue indicator`,
                        confidence: skillProfile.metadata?.profile_confidence || 0.7,
                        suggestedAction: skillProfile.explanation?.key_highlights?.find(h => h.includes('recovery') || h.includes('monitor')) || 'Consider rest period or monitoring'
                    });
                }
            } catch (error) {
                console.error(`Error analyzing driver fatigue ${driver.id}:`, error);
                // Continue with other drivers
            }
        }
        return fatiguedDrivers;
    };

    /**
     * Get suggested action based on route analysis
     */
    const getSuggestedAction = (routeAnalysis) => {
        if (routeAnalysis.risk_level === 'critical') {
            return 'CRITICAL: Route review strongly recommended. Consider alternative route or elite driver assignment.';
        } else if (routeAnalysis.risk_level === 'high') {
            return 'Assign experienced driver with strong skill profile. Enable real-time monitoring.';
        }
        return 'Monitor delivery progress closely. Consider buffer time in ETA.';
    };

    if (loading) {
        return (
            <DashboardLayout role="operator">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <Activity className="animate-spin mx-auto mb-2 text-blue-500" size={32} />
                        <div className="text-slate-500">Analyzing shipments and drivers...</div>
                        <div className="text-xs text-slate-400 mt-2">This may take a few moments</div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (insights.error) {
        return (
            <DashboardLayout role="operator">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center text-red-600">
                        <AlertTriangle className="mx-auto mb-2" size={32} />
                        <div className="font-medium">{insights.error}</div>
                        <button
                            onClick={fetchInsights}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                        >
                            Retry
                        </button>
                    </div>
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
                        <h1 className="text-2xl font-bold text-slate-800">Actionable Insights</h1>
                        <p className="text-slate-500">Intelligence-driven recommendations for today's operations</p>
                    </div>
                    <button
                        onClick={fetchInsights}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                        <Activity size={18} />
                        {loading ? 'Analyzing...' : 'Refresh Insights'}
                    </button>
                </div>

                {/* High Risk Deliveries */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="text-red-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">High Risk Deliveries Today</h2>
                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.highRiskDeliveries.length}
                        </span>
                    </div>
                    {insights.highRiskDeliveries.length === 0 ? (
                        <div className="text-slate-500 flex items-center gap-2">
                            <CheckCircle size={20} className="text-green-500" />
                            <span>No high-risk deliveries detected. All routes look manageable.</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {insights.highRiskDeliveries.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">
                                                Shipment #{insight.shipment.tracking_number}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {insight.shipment.origin} → {insight.shipment.destination}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Confidence</div>
                                            <div className="font-semibold text-slate-700">
                                                {(insight.confidence * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Risk Analysis:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <span>Risk Score: <strong className="text-red-600">{(insight.riskScore * 100).toFixed(0)}%</strong></span>
                                            <span>Level: <strong className="text-red-600 uppercase">{insight.routeAnalysis.risk_level}</strong></span>
                                        </div>
                                        {insight.keyContributors && insight.keyContributors.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-red-200">
                                                <div className="text-xs font-medium text-slate-600 mb-1">Key Risk Contributors:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {insight.keyContributors.slice(0, 3).map((contributor, cIdx) => (
                                                        <span key={cIdx} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                                            {contributor.factor.replace(/_/g, ' ')} ({contributor.contribution_percentage}%)
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-red-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommended Action:</div>
                                        <div className="text-sm text-slate-800 mb-2">{insight.suggestedAction}</div>
                                        {insight.routeAnalysis.recommendations && insight.routeAnalysis.recommendations.length > 0 && (
                                            <div className="text-xs text-slate-600 space-y-1">
                                                {insight.routeAnalysis.recommendations.slice(0, 2).map((rec, rIdx) => (
                                                    <div key={rIdx}>• {rec}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setSelectedRouteDetail(insight)}
                                        className="mt-2 w-full text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded transition"
                                    >
                                        View Route Details →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Drivers for Urgent Jobs */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="text-blue-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Drivers Best Suited for Urgent Jobs</h2>
                        <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.driversForUrgentJobs.length}
                        </span>
                    </div>
                    {insights.driversForUrgentJobs.length === 0 ? (
                        <div className="text-slate-500">No drivers with exceptional urgency handling identified.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights.driversForUrgentJobs.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">{insight.driver.name}</h3>
                                            <p className="text-sm text-slate-600">Driver ID: R{insight.driver.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Confidence</div>
                                            <div className="font-semibold text-slate-700">
                                                {(insight.confidence * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Skill Profile:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        {insight.skillVector && (
                                            <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-blue-200">
                                                <div>
                                                    <span className="text-slate-500">Urgency: </span>
                                                    <span className="font-semibold text-blue-700">{(insight.urgencyScore * 100).toFixed(0)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Recovery: </span>
                                                    <span className="font-semibold text-blue-700">{(insight.stressRecoveryScore * 100).toFixed(0)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Consistency: </span>
                                                    <span className="font-semibold text-blue-700">{(insight.skillVector.consistency * 100).toFixed(0)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Deliveries: </span>
                                                    <span className="font-semibold text-blue-700">{insight.skillProfile.metadata?.total_deliveries || 0}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommended Use:</div>
                                        <div className="text-sm text-slate-800 mb-2">{insight.suggestedAction}</div>
                                        {insight.skillProfile.explanation?.key_highlights && (
                                            <div className="text-xs text-slate-600">
                                                <div className="font-medium mb-1">Highlights:</div>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {insight.skillProfile.explanation.key_highlights.slice(0, 2).map((highlight, hIdx) => (
                                                        <li key={hIdx}>{highlight}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => navigate(`/operator/intelligence/drivers?driver=${insight.driver.id}`)}
                                        className="mt-2 w-full text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition"
                                    >
                                        View Full Profile →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Unusual Risk Routes */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <MapPin className="text-orange-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Routes with Unusual Risk Today</h2>
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.unusualRiskRoutes.length}
                        </span>
                    </div>
                    {insights.unusualRiskRoutes.length === 0 ? (
                        <div className="text-slate-500 flex items-center gap-2">
                            <CheckCircle size={20} className="text-green-500" />
                            <span>All routes show expected risk levels. No unusual patterns detected.</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {insights.unusualRiskRoutes.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">
                                                Route: {insight.shipment.origin} → {insight.shipment.destination}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                Shipment #{insight.shipment.tracking_number}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Risk Level</div>
                                            <div className="font-semibold text-orange-700 uppercase">
                                                {insight.routeAnalysis.risk_level}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Risk Analysis:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                            <span>Risk Score: <strong className="text-orange-600">{(insight.routeAnalysis.route_risk_score * 100).toFixed(0)}%</strong></span>
                                            <span>Level: <strong className="text-orange-600 uppercase">{insight.routeAnalysis.risk_level}</strong></span>
                                        </div>
                                        {insight.riskContributors && insight.riskContributors.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-orange-200">
                                                <div className="text-xs font-medium text-slate-600 mb-1">Contributors:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {insight.riskContributors.map((contributor, cIdx) => (
                                                        <span key={cIdx} className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                                                            {contributor.factor.replace(/_/g, ' ')} ({contributor.contribution_percentage}%)
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-orange-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommended Action:</div>
                                        <div className="text-sm text-slate-800 mb-2">{insight.suggestedAction}</div>
                                        {insight.routeAnalysis.recommendations && insight.routeAnalysis.recommendations.length > 0 && (
                                            <div className="text-xs text-slate-600 space-y-1">
                                                {insight.routeAnalysis.recommendations.slice(0, 2).map((rec, rIdx) => (
                                                    <div key={rIdx}>• {rec}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setSelectedRouteDetail(insight)}
                                        className="mt-2 w-full text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded transition"
                                    >
                                        Review Route Alternatives →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Fatigue/Stress Drivers */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Activity className="text-purple-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Drivers Showing Fatigue or Stress Patterns</h2>
                        <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.fatigueStressDrivers.length}
                        </span>
                    </div>
                    {insights.fatigueStressDrivers.length === 0 ? (
                        <div className="text-slate-500 flex items-center gap-2">
                            <CheckCircle size={20} className="text-green-500" />
                            <span>All drivers showing healthy stress recovery and consistent performance.</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {insights.fatigueStressDrivers.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">{insight.driver.name}</h3>
                                            <p className="text-sm text-slate-600">Driver ID: R{insight.driver.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Confidence</div>
                                            <div className="font-semibold text-slate-700">
                                                {(insight.confidence * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Performance Pattern:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-purple-200">
                                            <div>
                                                <span className="text-slate-500">Stress Recovery: </span>
                                                <span className={`font-semibold ${insight.stressRecovery < 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {(insight.stressRecovery * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Consistency: </span>
                                                <span className={`font-semibold ${insight.consistency < 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {(insight.consistency * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Total Deliveries: </span>
                                                <span className="font-semibold text-slate-700">{insight.totalDeliveries}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Avg Delay: </span>
                                                <span className={`font-semibold ${insight.avgDelay > 30 ? 'text-orange-600' : 'text-green-600'}`}>
                                                    {insight.avgDelay?.toFixed(1) || '0'} min
                                                </span>
                                            </div>
                                        </div>
                                        {insight.skillProfile && insight.skillProfile.explanation && (
                                            <div className="mt-2 text-xs text-slate-600 italic">
                                                {insight.skillProfile.explanation.summary}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-purple-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommended Action:</div>
                                        <div className="text-sm text-slate-800 mb-2">{insight.suggestedAction}</div>
                                        <div className="text-xs text-slate-600">
                                            Profile confidence: {(insight.confidence * 100).toFixed(0)}% | 
                                            Based on {insight.totalDeliveries} historical deliveries
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedDevelopmentPlan(insight)}
                                        className="mt-2 w-full text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded transition"
                                    >
                                        View Development Plan →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Footer Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <Info className="text-blue-500 mt-0.5" size={20} />
                    <div className="text-sm text-slate-700">
                        <div className="font-medium mb-1">About These Insights</div>
                        <div>
                            All insights are generated by intelligence modules and are advisory recommendations only.
                            Operators maintain full control over all decisions. Confidence levels indicate reliability
                            of the analysis based on available historical data.
                        </div>
                    </div>
                </div>
            </div>

            {/* Route Details Modal */}
            {selectedRouteDetail && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedRouteDetail(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Route Details</h2>
                                <p className="text-slate-500 text-sm mt-1">
                                    Shipment #{selectedRouteDetail.shipment.tracking_number} • {selectedRouteDetail.shipment.origin} → {selectedRouteDetail.shipment.destination}
                                </p>
                            </div>
                            <button onClick={() => setSelectedRouteDetail(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Map */}
                            <div className="h-[400px] rounded-lg overflow-hidden border border-slate-200">
                                <MapComponent shipments={[selectedRouteDetail.shipment]} />
                            </div>
                            
                            {/* Risk Analysis */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                    <div className="text-sm font-medium text-red-700 mb-2">Risk Level</div>
                                    <div className="text-2xl font-bold text-red-600 uppercase">{selectedRouteDetail.routeAnalysis.risk_level}</div>
                                    <div className="text-xs text-red-600 mt-1">Score: {(selectedRouteDetail.riskScore * 100).toFixed(0)}%</div>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                    <div className="text-sm font-medium text-orange-700 mb-2">Confidence</div>
                                    <div className="text-2xl font-bold text-orange-600">{(selectedRouteDetail.confidence * 100).toFixed(0)}%</div>
                                    <div className="text-xs text-orange-600 mt-1">Analysis reliability</div>
                                </div>
                            </div>

                            {/* Key Contributors */}
                            {selectedRouteDetail.keyContributors && selectedRouteDetail.keyContributors.length > 0 && (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="text-sm font-semibold text-slate-700 mb-3">Key Risk Contributors</div>
                                    <div className="space-y-2">
                                        {selectedRouteDetail.keyContributors.map((contributor, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                                                <span className="text-sm text-slate-700 capitalize">{contributor.factor.replace(/_/g, ' ')}</span>
                                                <span className="font-semibold text-slate-800">{contributor.contribution_percentage}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Explanation */}
                            {selectedRouteDetail.routeAnalysis.explanation && (
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="text-sm font-semibold text-blue-700 mb-2">Analysis Summary</div>
                                    <div className="text-sm text-slate-700">{selectedRouteDetail.routeAnalysis.explanation.summary}</div>
                                    {selectedRouteDetail.routeAnalysis.explanation.detailed_breakdown && (
                                        <div className="mt-3 space-y-1">
                                            {selectedRouteDetail.routeAnalysis.explanation.detailed_breakdown.map((detail, idx) => (
                                                <div key={idx} className="text-xs text-slate-600">• {detail}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Recommendations */}
                            {selectedRouteDetail.routeAnalysis.recommendations && selectedRouteDetail.routeAnalysis.recommendations.length > 0 && (
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div className="text-sm font-semibold text-green-700 mb-2">Recommendations</div>
                                    <ul className="space-y-2">
                                        {selectedRouteDetail.routeAnalysis.recommendations.map((rec, idx) => (
                                            <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                                                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Development Plan Modal */}
            {selectedDevelopmentPlan && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedDevelopmentPlan(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Development Plan</h2>
                                <p className="text-slate-500 text-sm mt-1">
                                    {selectedDevelopmentPlan.driver.name} (Driver ID: R{selectedDevelopmentPlan.driver.id})
                                </p>
                            </div>
                            <button onClick={() => setSelectedDevelopmentPlan(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Performance Summary */}
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="text-sm font-semibold text-purple-700 mb-3">Performance Pattern</div>
                                <div className="text-sm text-slate-700 mb-4">{selectedDevelopmentPlan.reason}</div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span className="text-slate-500">Stress Recovery: </span>
                                        <span className={`font-semibold ${selectedDevelopmentPlan.stressRecovery < 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                                            {(selectedDevelopmentPlan.stressRecovery * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Consistency: </span>
                                        <span className={`font-semibold ${selectedDevelopmentPlan.consistency < 0.5 ? 'text-red-600' : 'text-green-600'}`}>
                                            {(selectedDevelopmentPlan.consistency * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Total Deliveries: </span>
                                        <span className="font-semibold text-slate-700">{selectedDevelopmentPlan.totalDeliveries}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Avg Delay: </span>
                                        <span className={`font-semibold ${selectedDevelopmentPlan.avgDelay > 30 ? 'text-orange-600' : 'text-green-600'}`}>
                                            {selectedDevelopmentPlan.avgDelay?.toFixed(1) || '0'} min
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Recommended Action */}
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-sm font-semibold text-blue-700 mb-2">Recommended Action</div>
                                <div className="text-sm text-slate-800">{selectedDevelopmentPlan.suggestedAction}</div>
                            </div>

                            {/* Skill Profile Details */}
                            {selectedDevelopmentPlan.skillProfile && selectedDevelopmentPlan.skillProfile.explanation && (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="text-sm font-semibold text-slate-700 mb-2">Skill Analysis</div>
                                    <div className="text-sm text-slate-600 mb-3">{selectedDevelopmentPlan.skillProfile.explanation.summary}</div>
                                    {selectedDevelopmentPlan.skillProfile.explanation.key_highlights && (
                                        <ul className="space-y-2">
                                            {selectedDevelopmentPlan.skillProfile.explanation.key_highlights.map((highlight, idx) => (
                                                <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                                                    <Info size={14} className="text-purple-600 mt-0.5 flex-shrink-0" />
                                                    <span>{highlight}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {/* View Full Profile Button */}
                            <button
                                onClick={() => {
                                    setSelectedDevelopmentPlan(null);
                                    navigate(`/operator/intelligence/drivers?driver=${selectedDevelopmentPlan.driver.id}`);
                                }}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium transition"
                            >
                                View Full Development Dashboard →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default ActionableInsights;
