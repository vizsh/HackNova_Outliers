/**
 * Cost Optimization Intelligence
 * 
 * Reduces cost without hurting SLA by identifying optimization opportunities.
 * 
 * Features:
 * - High fuel usage routes
 * - Underutilized drivers with high skill
 * - Costly delays due to poor driver-route fit
 * - When cheaper options increase failure risk
 * 
 * Metrics:
 * - Cost per successful delivery
 * - Cost of delay vs cost of reassignment
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Card } from '../../components/common/UI';
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Info, Zap, Truck, Clock, Shield, X, MapPin, CheckCircle } from 'lucide-react';
import MapComponent from '../../components/MapComponent';
import RouteComparisonMap from '../../components/RouteComparisonMap';
import * as intelligenceApi from '../../utils/intelligenceApi';

const CostOptimization = () => {
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState({
        highFuelRoutes: [],
        underutilizedDrivers: [],
        poorFitCosts: [],
        riskTradeoffs: []
    });
    const [metrics, setMetrics] = useState({
        avgCostPerDelivery: 0,
        avgDelayCost: 0,
        avgReassignmentCost: 0,
        costSavingsPotential: 0
    });
    const [selectedRouteOptimization, setSelectedRouteOptimization] = useState(null);

    useEffect(() => {
        fetchCostInsights();
    }, []);

    /**
     * Fetch cost optimization insights from intelligence modules
     */
    const fetchCostInsights = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch data
            const [shipmentsRes, driversRes] = await Promise.all([
                axios.get('http://localhost:3000/api/data/shipments', { headers }),
                axios.get('http://localhost:3000/api/data/drivers', { headers })
            ]);

            const shipments = shipmentsRes.data.filter(s => s.status === 'in_transit' || s.status === 'delivered');
            const drivers = driversRes.data;

            // 1. High fuel usage routes
            const highFuelRoutes = await identifyHighFuelRoutes(shipments);

            // 2. Underutilized drivers with high skill
            const underutilizedDrivers = await identifyUnderutilizedDrivers(drivers, shipments);

            // 3. Costly delays due to poor driver-route fit
            const poorFitCosts = await identifyPoorFitCosts(shipments, drivers);

            // 4. Risk trade-offs (cheaper options that increase failure risk)
            const riskTradeoffs = await identifyRiskTradeoffs(shipments, drivers);

            // Calculate metrics (pass highFuelRoutes explicitly)
            const calculatedMetrics = calculateCostMetrics(shipments, poorFitCosts, highFuelRoutes);

            setInsights({
                highFuelRoutes,
                underutilizedDrivers,
                poorFitCosts,
                riskTradeoffs
            });
            setMetrics(calculatedMetrics);
        } catch (error) {
            console.error('Error fetching cost insights:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Identify high fuel usage routes using backend API
     */
    const identifyHighFuelRoutes = async (shipments) => {
        const highFuel = [];
        const avgFuelCost = 150; // Baseline average (₹150)
        
        for (const shipment of shipments.slice(0, 15)) {
            try {
                // Get route analysis from backend with shipmentId
                const routeAnalysis = await intelligenceApi.analyzeRouteRisk(null, shipment.id || shipment.tracking_number);
                
                // Get delay prediction to calculate actual costs
                const delayPrediction = await intelligenceApi.predictDelay(null, null, {}, shipment.id || shipment.tracking_number);
                
                // Calculate distance and fuel cost from enriched data or actual coordinates
                const distance = calculateDistance(shipment);
                const fuelCost = shipment.invoice_amount ? shipment.invoice_amount * 0.1 : distance * 0.15; // 10% of invoice or distance-based
                
                // Consider route difficulty and traffic in fuel cost
                const routeFactor = (routeAnalysis.route_risk_score || 0.5) + 0.5; // 0.5-1.5 multiplier
                const adjustedFuelCost = fuelCost * routeFactor;

                if (adjustedFuelCost > avgFuelCost * 1.2) { // 20% above average
                    highFuel.push({
                        shipment,
                        distance: parseFloat(distance.toFixed(1)),
                        fuelCost: parseFloat(adjustedFuelCost.toFixed(2)),
                        routeAnalysis,
                        delayPrediction,
                        reason: routeAnalysis.explanation?.summary || `High fuel cost (₹${adjustedFuelCost.toFixed(2)}) due to long distance (${distance.toFixed(1)} km) and route complexity (risk: ${(routeAnalysis.route_risk_score * 100).toFixed(0)}%)`,
                        savingsPotential: parseFloat((adjustedFuelCost - avgFuelCost).toFixed(2)),
                        suggestion: routeAnalysis.recommendations?.[0] || 'Consider route optimization or alternative route',
                        riskFactors: routeAnalysis.key_contributors || []
                    });
                }
            } catch (error) {
                console.error(`Error analyzing fuel for shipment ${shipment.id}:`, error);
                // Continue with other shipments
            }
        }
        return highFuel.sort((a, b) => b.fuelCost - a.fuelCost).slice(0, 5);
    };

    /**
     * Identify underutilized drivers with high skill
     */
    const identifyUnderutilizedDrivers = async (drivers, shipments) => {
        const underutilized = [];
        
        for (const driver of drivers.slice(0, 10)) {
            try {
                // Count driver's active deliveries
                const driverShipments = shipments.filter(s => s.driver_id === driver.id);
                const activeCount = driverShipments.filter(s => s.status === 'in_transit' || s.status === 'assigned').length;
                const avgActiveCount = shipments.length / drivers.length;

                // Get driver skill profile
                const driverId = `R${driver.id || 0}`;
                const skillProfile = await intelligenceApi.getDriverSkillProfile(driverId);

                if (!skillProfile || !skillProfile.skill_vector) continue;

                // Check if underutilized (fewer active deliveries than average)
                if (activeCount < avgActiveCount * 0.7 && skillProfile.skill_vector) {
                    const overallSkill = Object.values(skillProfile.skill_vector).reduce((sum, val) => sum + val, 0) / Object.values(skillProfile.skill_vector).length;
                    
                    if (overallSkill > 0.65) { // High skill threshold
                        underutilized.push({
                            driver,
                            skillProfile,
                            activeCount,
                            avgActiveCount: Math.round(avgActiveCount),
                            overallSkill: overallSkill.toFixed(2),
                            reason: `Driver ${driver.name} has high skills (${(overallSkill * 100).toFixed(0)}%) but only ${activeCount} active deliveries (avg: ${Math.round(avgActiveCount)})`,
                            suggestion: 'Consider assigning more deliveries to utilize skills',
                            potentialValue: 'Can handle complex/high-value deliveries'
                        });
                    }
                }
            } catch (error) {
                console.error(`Error analyzing driver ${driver.id}:`, error);
            }
        }
        return underutilized;
    };

    /**
     * Identify costly delays due to poor driver-route fit
     */
    const identifyPoorFitCosts = async (shipments, drivers) => {
        const poorFit = [];
        
        for (const shipment of shipments.slice(0, 15)) {
            if (!shipment.driver_id) continue;

            try {
                const driver = drivers.find(d => d.id === shipment.driver_id);
                if (!driver) continue;

                // Get driver profile and route analysis using backend API
                const driverId = `R${driver.id}`;
                const driverProfile = await intelligenceApi.getDriverSkillProfile(driverId);
                
                if (!driverProfile || !driverProfile.skill_vector) continue;

                // Get route analysis using shipmentId
                const routeAnalysis = await intelligenceApi.analyzeRouteRisk(null, shipment.id || shipment.tracking_number);
                
                // Calculate driver-route fit using shipmentId and driverId
                const fitAnalysis = await axios.post(
                    'http://localhost:3000/api/intelligence/driver-route-fit',
                    { 
                        driverId: driverId,
                        shipmentId: shipment.id || shipment.tracking_number
                    },
                    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
                ).then(res => res.data).catch(e => null);

                if (!fitAnalysis) continue;

                // Identify poor fit (low success probability)
                if (fitAnalysis.success_probability < 0.6) { // Lower threshold to catch more cases
                    const delayPrediction = await intelligenceApi.predictDelay(
                        null, null, {}, shipment.id || shipment.tracking_number, driverId
                    );

                    if (!delayPrediction) continue;

                    // Estimate cost of delay (₹0.5 per minute delay)
                    const delayCost = delayPrediction.predicted_delay_minutes * 0.5;
                    // Estimated cost of reassignment (₹50 base + driver difference)
                    const reassignmentCost = 50;
                    // Cost per successful delivery
                    const costPerSuccess = shipment.invoice_amount / (fitAnalysis.success_probability || 0.5);

                    poorFit.push({
                        shipment,
                        driver,
                        fitAnalysis,
                        delayPrediction,
                        delayCost: parseFloat(delayCost.toFixed(2)),
                        reassignmentCost,
                        costPerSuccess: parseFloat(costPerSuccess.toFixed(2)),
                        reason: fitAnalysis.explanation?.summary || `Poor driver-route fit (${(fitAnalysis.success_probability * 100).toFixed(0)}% success probability) may cause delays costing ₹${delayCost.toFixed(2)}`,
                        suggestion: fitAnalysis.recommendations?.[0] || (delayCost > reassignmentCost 
                            ? 'Consider reassignment - cost of delay exceeds reassignment cost'
                            : 'Monitor closely - current assignment acceptable but risky'),
                        costVsReassignment: delayCost > reassignmentCost 
                            ? `Delay cost (₹${delayCost.toFixed(2)}) exceeds reassignment cost (₹${reassignmentCost})` 
                            : `Reassignment cost (₹${reassignmentCost}) higher than potential delay (₹${delayCost.toFixed(2)})`,
                        explanation: fitAnalysis.explanation?.detailed_explanations || []
                    });
                }
            } catch (error) {
                console.error(`Error analyzing fit for shipment ${shipment.id}:`, error);
            }
        }
        return poorFit;
    };

    /**
     * Identify risk trade-offs (cheaper options that increase failure risk)
     * Uses backend API to get real driver-route fit analysis
     */
    const identifyRiskTradeoffs = async (shipments, drivers) => {
        const tradeoffs = [];
        const token = localStorage.getItem('token');
        
        for (const shipment of shipments.slice(0, 10)) {
            if (!shipment.driver_id) continue;

            try {
                const driver = drivers.find(d => d.id === shipment.driver_id);
                if (!driver) continue;

                // Get driver-route fit using backend API
                const driverId = `R${driver.id}`;
                
                // Check if current assignment has low success probability (risky but cheaper)
                try {
                    const fitAnalysis = await axios.post(
                        'http://localhost:3000/api/intelligence/driver-route-fit',
                        { 
                            driverId: driverId,
                            shipmentId: shipment.id || shipment.tracking_number
                        },
                        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
                    ).then(res => res.data).catch(e => null);

                    if (!fitAnalysis || fitAnalysis.success_probability >= 0.6) continue;

                    // Calculate cost difference
                    const currentCost = shipment.invoice_amount || 10000;
                    const estimatedPremiumCost = currentCost * 1.15; // 15% premium for better driver
                    const costSavings = estimatedPremiumCost - currentCost;

                    // Calculate failure risk cost
                    const failureRisk = (1 - fitAnalysis.success_probability);
                    const estimatedFailureCost = currentCost * failureRisk * 0.5; // 50% of shipment value if failed

                    tradeoffs.push({
                        shipment,
                        driver,
                        fitAnalysis,
                        currentCost: parseFloat(currentCost.toFixed(2)),
                        estimatedPremiumCost: parseFloat(estimatedPremiumCost.toFixed(2)),
                        costSavings: parseFloat(costSavings.toFixed(2)),
                        estimatedFailureCost: parseFloat(estimatedFailureCost.toFixed(2)),
                        reason: fitAnalysis.explanation?.summary || `Current assignment has low success probability (${(fitAnalysis.success_probability * 100).toFixed(0)}%) but saves ₹${costSavings.toFixed(2)}`,
                        risk: `Higher failure risk (${(failureRisk * 100).toFixed(0)}%) may cause delays, customer dissatisfaction, and re-delivery costs (₹${estimatedFailureCost.toFixed(2)})`,
                        recommendation: fitAnalysis.recommendations?.[0] || 'Consider investing in better driver assignment for critical deliveries',
                        tradeoffAnalysis: `Cheaper option saves ₹${costSavings.toFixed(2)} but increases failure risk by ${(failureRisk * 100).toFixed(0)}% (potential loss: ₹${estimatedFailureCost.toFixed(2)})`,
                        explanation: fitAnalysis.explanation?.detailed_explanations || []
                    });
                } catch (e) {
                    console.error(`Error getting fit analysis for shipment ${shipment.id}:`, e);
                    continue;
                }
            } catch (error) {
                console.error(`Error analyzing tradeoff for shipment ${shipment.id}:`, error);
                // Continue with other shipments
            }
        }
        return tradeoffs;
    };

    /**
     * Calculate cost metrics from actual data
     */
    const calculateCostMetrics = (shipments, poorFitCosts, highFuelRoutes = []) => {
        const delivered = shipments.filter(s => s.status === 'delivered');
        const totalCost = delivered.reduce((sum, s) => sum + (s.invoice_amount || 0), 0);
        const avgCostPerDelivery = delivered.length > 0 ? totalCost / delivered.length : 0;

        const totalDelayCost = poorFitCosts.reduce((sum, item) => sum + parseFloat(item.delayCost || 0), 0);
        const avgDelayCost = poorFitCosts.length > 0 ? totalDelayCost / poorFitCosts.length : 0;

        // Calculate actual fuel savings
        const fuelSavings = highFuelRoutes.reduce((sum, route) => sum + parseFloat(route.savingsPotential || 0), 0);
        
        const avgReassignmentCost = 50; // Estimated base cost (₹50)
        const costSavingsPotential = (totalDelayCost * 0.3) + fuelSavings; // 30% delay reduction + fuel savings

        // Calculate cost per successful delivery (considering poor fits)
        const totalSuccessful = delivered.length;
        const costPerSuccess = totalSuccessful > 0 ? totalCost / totalSuccessful : avgCostPerDelivery;

        return {
            avgCostPerDelivery: parseFloat(avgCostPerDelivery.toFixed(2)),
            avgDelayCost: parseFloat(avgDelayCost.toFixed(2)),
            avgReassignmentCost: parseFloat(avgReassignmentCost.toFixed(2)),
            costSavingsPotential: parseFloat(costSavingsPotential.toFixed(2)),
            fuelSavings: parseFloat(fuelSavings.toFixed(2)),
            costPerSuccess: parseFloat(costPerSuccess.toFixed(2)),
            totalDeliveries: delivered.length,
            poorFitCount: poorFitCosts.length
        };
    };

    /**
     * Calculate distance between pickup and drop points
     */
    const calculateDistance = (shipment) => {
        if (!shipment.pickup_lat || !shipment.drop_lat) return 50;
        
        const R = 6371; // Earth radius in km
        const dLat = (shipment.drop_lat - shipment.pickup_lat) * Math.PI / 180;
        const dLon = (shipment.drop_lng - shipment.pickup_lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(shipment.pickup_lat * Math.PI / 180) * Math.cos(shipment.drop_lat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    if (loading) {
        return (
            <DashboardLayout role="operator">
                <div className="flex items-center justify-center h-64">
                    <div className="text-slate-500">Analyzing cost optimization opportunities...</div>
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
                        <h1 className="text-2xl font-bold text-slate-800">Cost Optimization Intelligence</h1>
                        <p className="text-slate-500">Reduce costs without hurting SLA</p>
                    </div>
                    <button
                        onClick={fetchCostInsights}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                        <TrendingDown size={18} />
                        {loading ? 'Analyzing...' : 'Refresh Analysis'}
                    </button>
                </div>

                {/* Cost Metrics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="p-4 border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="text-blue-500" size={20} />
                            <div className="text-sm text-slate-500">Avg Cost/Delivery</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">₹{metrics.avgCostPerDelivery || 0}</div>
                        <div className="text-xs text-slate-500 mt-1">{metrics.totalDeliveries || 0} deliveries</div>
                    </Card>
                    <Card className="p-4 border-l-4 border-orange-500">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="text-orange-500" size={20} />
                            <div className="text-sm text-slate-500">Avg Delay Cost</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">₹{metrics.avgDelayCost || 0}</div>
                        <div className="text-xs text-slate-500 mt-1">{metrics.poorFitCount || 0} poor fits</div>
                    </Card>
                    <Card className="p-4 border-l-4 border-purple-500">
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="text-purple-500" size={20} />
                            <div className="text-sm text-slate-500">Reassignment Cost</div>
                        </div>
                        <div className="text-2xl font-bold text-slate-800">₹{metrics.avgReassignmentCost || 0}</div>
                        <div className="text-xs text-slate-500 mt-1">Base cost per reassignment</div>
                    </Card>
                    <Card className="p-4 border-l-4 border-green-500">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="text-green-500" size={20} />
                            <div className="text-sm text-slate-500">Savings Potential</div>
                        </div>
                        <div className="text-2xl font-bold text-green-600">₹{metrics.costSavingsPotential || 0}</div>
                        <div className="text-xs text-slate-500 mt-1">
                            Fuel: ₹{metrics.fuelSavings || 0} | Delays: ₹{((metrics.avgDelayCost || 0) * 0.3).toFixed(0)}
                        </div>
                    </Card>
                </div>

                {/* High Fuel Routes */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Zap className="text-yellow-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">High Fuel Usage Routes</h2>
                        <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.highFuelRoutes.length}
                        </span>
                    </div>
                    {insights.highFuelRoutes.length === 0 ? (
                        <div className="text-slate-500">No high fuel usage routes detected. Fuel efficiency looks good.</div>
                    ) : (
                        <div className="space-y-4">
                            {insights.highFuelRoutes.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded-r-lg">
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
                                            <div className="text-xs text-slate-500">Distance</div>
                                            <div className="text-sm font-semibold text-slate-700">{insight.distance} km</div>
                                            <div className="text-xs text-slate-500 mt-1">Fuel Cost</div>
                                            <div className="text-sm font-semibold text-yellow-700">₹{insight.fuelCost.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Cost Analysis:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        {insight.riskFactors && insight.riskFactors.length > 0 && (
                                            <div className="text-xs text-slate-500 mb-2">
                                                Risk factors: {insight.riskFactors.map(f => f.factor.replace(/_/g, ' ')).join(', ')}
                                            </div>
                                        )}
                                        <div className="bg-white p-2 rounded border border-yellow-200 mt-2">
                                            <div className="text-xs font-medium text-yellow-700 mb-1">Potential Savings:</div>
                                            <div className="text-lg font-bold text-yellow-800">₹{insight.savingsPotential}</div>
                                            <div className="text-xs text-slate-500">with route optimization</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommended Action:</div>
                                        <div className="text-sm text-slate-800">{insight.suggestion}</div>
                                        {insight.delayPrediction && (
                                            <div className="text-xs text-slate-600 mt-2">
                                                Predicted delay: {insight.delayPrediction.predicted_delay_minutes} min ({insight.delayPrediction.delay_risk_band} risk)
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setSelectedRouteOptimization(insight)}
                                        className="mt-2 w-full text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded transition flex items-center justify-center gap-2"
                                    >
                                        <MapPin size={14} />
                                        Review Route Optimization →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Underutilized Drivers */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Truck className="text-blue-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Underutilized High-Skill Drivers</h2>
                        <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.underutilizedDrivers.length}
                        </span>
                    </div>
                    {insights.underutilizedDrivers.length === 0 ? (
                        <div className="text-slate-500">All drivers are appropriately utilized.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {insights.underutilizedDrivers.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
                                    <div className="mb-2">
                                        <h3 className="font-semibold text-slate-800">{insight.driver.name}</h3>
                                        <p className="text-sm text-slate-600">ID: R{insight.driver.id}</p>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Utilization Analysis:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-blue-200">
                                            <div>
                                                <span className="text-slate-500">Active: </span>
                                                <span className="font-semibold text-blue-700">{insight.activeCount}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Average: </span>
                                                <span className="font-semibold text-slate-700">{insight.avgActiveCount}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Overall Skill: </span>
                                                <span className="font-semibold text-blue-700">{(insight.overallSkill * 100).toFixed(0)}%</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Deliveries: </span>
                                                <span className="font-semibold text-slate-700">{insight.skillProfile.metadata?.total_deliveries || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommended Action:</div>
                                        <div className="text-sm text-slate-800 mb-2">{insight.suggestion}</div>
                                        <div className="text-xs text-blue-700 mt-2 font-medium">Potential Value: {insight.potentialValue}</div>
                                        {insight.skillProfile.explanation?.key_highlights && (
                                            <div className="text-xs text-slate-600 mt-2">
                                                {insight.skillProfile.explanation.key_highlights.slice(0, 2).map((highlight, hIdx) => (
                                                    <div key={hIdx}>• {highlight}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => window.location.hash = `/operator/intelligence/drivers?driver=${insight.driver.id}`}
                                        className="mt-2 w-full text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition"
                                    >
                                        View Driver Profile →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Poor Fit Costs */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="text-orange-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Costly Delays from Poor Driver-Route Fit</h2>
                        <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.poorFitCosts.length}
                        </span>
                    </div>
                    {insights.poorFitCosts.length === 0 ? (
                        <div className="text-slate-500">No poor driver-route fits detected. All assignments look good.</div>
                    ) : (
                        <div className="space-y-4">
                            {insights.poorFitCosts.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">
                                                Shipment #{insight.shipment.tracking_number}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {insight.shipment.origin} → {insight.shipment.destination}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Driver: {insight.driver.name} (R{insight.driver.id})
                                            </p>
                                        </div>
                                        <div className="text-right bg-white p-2 rounded border border-orange-200">
                                            <div className="text-xs text-slate-500">Success Probability</div>
                                            <div className={`text-lg font-bold ${insight.fitAnalysis.success_probability < 0.4 ? 'text-red-600' : 'text-orange-600'}`}>
                                                {(insight.fitAnalysis.success_probability * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                                        <div className="bg-white p-2 rounded border border-orange-200">
                                            <div className="text-xs text-slate-500 mb-1">Delay Cost</div>
                                            <div className="font-semibold text-orange-700">₹{insight.delayCost}</div>
                                            <div className="text-xs text-slate-500">{insight.delayPrediction?.predicted_delay_minutes || 0} min delay</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-orange-200">
                                            <div className="text-xs text-slate-500 mb-1">Reassignment Cost</div>
                                            <div className="font-semibold text-orange-700">₹{insight.reassignmentCost}</div>
                                            <div className="text-xs text-slate-500">Base cost</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-orange-200">
                                            <div className="text-xs text-slate-500 mb-1">Cost/Success</div>
                                            <div className="font-semibold text-orange-700">₹{insight.costPerSuccess}</div>
                                            <div className="text-xs text-slate-500">Per delivery</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-orange-200">
                                            <div className="text-xs text-slate-500 mb-1">Fit Score</div>
                                            <div className="font-semibold text-orange-700">{(insight.fitAnalysis.fit_score * 100).toFixed(0)}%</div>
                                            <div className="text-xs text-slate-500">Skill-route match</div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Cost Analysis:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        {insight.explanation && insight.explanation.length > 0 && (
                                            <div className="text-xs text-slate-500 space-y-1 mb-2">
                                                {insight.explanation.slice(0, 2).map((exp, eIdx) => (
                                                    <div key={eIdx}>• {exp}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-orange-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommended Action:</div>
                                        <div className="text-sm text-slate-800 mb-2">{insight.suggestion}</div>
                                        <div className="text-xs text-orange-700 font-medium">{insight.costVsReassignment}</div>
                                        {insight.fitAnalysis.explanation && (
                                            <div className="text-xs text-slate-600 mt-2 italic">
                                                {insight.fitAnalysis.explanation.summary}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => window.location.hash = `/operator/intelligence/drivers?driver=${insight.driver.id}`}
                                        className="mt-2 w-full text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded transition"
                                    >
                                        Review Driver Assignment →
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Risk Trade-offs */}
                <Card className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className="text-red-500" size={24} />
                        <h2 className="text-xl font-bold text-slate-800">Risk Trade-offs: Cost vs Failure Risk</h2>
                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-sm font-medium">
                            {insights.riskTradeoffs.length}
                        </span>
                    </div>
                    {insights.riskTradeoffs.length === 0 ? (
                        <div className="text-slate-500">No risky cost trade-offs identified.</div>
                    ) : (
                        <div className="space-y-4">
                            {insights.riskTradeoffs.map((insight, idx) => (
                                <div key={idx} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-semibold text-slate-800">
                                                Shipment #{insight.shipment.tracking_number}
                                            </h3>
                                            <p className="text-sm text-slate-600">
                                                {insight.shipment.origin} → {insight.shipment.destination}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Driver: {insight.driver.name} (R{insight.driver.id})
                                            </p>
                                        </div>
                                        <div className="text-right bg-white p-2 rounded border border-red-200">
                                            <div className="text-xs text-slate-500">Success</div>
                                            <div className={`text-lg font-bold ${insight.fitAnalysis.success_probability < 0.4 ? 'text-red-600' : 'text-orange-600'}`}>
                                                {(insight.fitAnalysis.success_probability * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                                        <div className="bg-white p-2 rounded border border-red-200">
                                            <div className="text-xs text-slate-500 mb-1">Current Cost</div>
                                            <div className="font-semibold text-green-600">₹{insight.currentCost}</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-red-200">
                                            <div className="text-xs text-slate-500 mb-1">Premium Cost</div>
                                            <div className="font-semibold text-slate-700">₹{insight.estimatedPremiumCost}</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-red-200">
                                            <div className="text-xs text-slate-500 mb-1">Savings</div>
                                            <div className="font-semibold text-green-600">₹{insight.costSavings}</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border border-red-200">
                                            <div className="text-xs text-slate-500 mb-1">Failure Risk Cost</div>
                                            <div className="font-semibold text-red-600">₹{insight.estimatedFailureCost}</div>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <div className="text-sm font-medium text-slate-700 mb-1">Trade-off Analysis:</div>
                                        <div className="text-sm text-slate-600 mb-2">{insight.reason}</div>
                                        <div className="text-sm text-red-700 mb-2 font-medium bg-white p-2 rounded border border-red-200">
                                            ⚠ Risk: {insight.risk}
                                        </div>
                                        {insight.explanation && insight.explanation.length > 0 && (
                                            <div className="text-xs text-slate-500 space-y-1 mb-2">
                                                {insight.explanation.slice(0, 2).map((exp, eIdx) => (
                                                    <div key={eIdx}>• {exp}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 p-3 bg-white rounded border border-red-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Recommendation:</div>
                                        <div className="text-sm text-slate-800 mb-2">{insight.recommendation}</div>
                                        <div className="text-xs text-red-700 font-medium bg-red-50 p-2 rounded border border-red-200">
                                            {insight.tradeoffAnalysis}
                                        </div>
                                        {insight.fitAnalysis.explanation && (
                                            <div className="text-xs text-slate-600 mt-2 italic">
                                                {insight.fitAnalysis.explanation.summary}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            // Track this as a decision - operator can choose to keep or change
                                            alert(`Review recommendation for shipment ${insight.shipment.tracking_number}:\n\n${insight.recommendation}\n\n${insight.tradeoffAnalysis}`);
                                        }}
                                        className="mt-2 w-full text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded transition"
                                    >
                                        Review Assignment Decision →
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
                        <div className="font-medium mb-1">About Cost Optimization</div>
                        <div>
                            All recommendations prioritize SLA and service quality. Cost savings are identified
                            only when they don't compromise delivery success or customer satisfaction. Metrics
                            are estimates based on historical data and route analysis.
                        </div>
                    </div>
                </div>
            </div>

            {/* Route Optimization Review Modal */}
            {selectedRouteOptimization && selectedRouteOptimization.shipment && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedRouteOptimization(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Route Optimization Review</h2>
                                <p className="text-slate-500 text-sm mt-1">
                                    Shipment #{selectedRouteOptimization.shipment?.tracking_number || 'N/A'} • {selectedRouteOptimization.shipment?.origin || 'Unknown'} → {selectedRouteOptimization.shipment?.destination || 'Unknown'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedRouteOptimization(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Map View */}
                            <div className="h-[400px] rounded-lg overflow-hidden border border-slate-200">
                                {selectedRouteOptimization.shipment ? (
                                    <MapComponent shipments={[selectedRouteOptimization.shipment]} />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-500">
                                        Map unavailable - shipment data missing
                                    </div>
                                )}
                            </div>

                            {/* Cost Analysis Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <div className="text-sm font-medium text-yellow-700 mb-2">Current Fuel Cost</div>
                                    <div className="text-2xl font-bold text-yellow-800">₹{(selectedRouteOptimization.fuelCost || 0).toFixed(2)}</div>
                                    <div className="text-xs text-slate-500 mt-1">Distance: {selectedRouteOptimization.distance || 0} km</div>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div className="text-sm font-medium text-green-700 mb-2">Potential Savings</div>
                                    <div className="text-2xl font-bold text-green-600">₹{(selectedRouteOptimization.savingsPotential || 0).toFixed(2)}</div>
                                    <div className="text-xs text-slate-500 mt-1">With route optimization</div>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="text-sm font-medium text-blue-700 mb-2">Route Risk Score</div>
                                    <div className="text-2xl font-bold text-blue-800">
                                        {selectedRouteOptimization.routeAnalysis ? ((selectedRouteOptimization.routeAnalysis.route_risk_score || 0) * 100).toFixed(0) : '0'}%
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 uppercase">{selectedRouteOptimization.routeAnalysis?.risk_level || 'UNKNOWN'} Risk</div>
                                </div>
                            </div>

                            {/* Cost Analysis Details */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h3 className="font-bold text-lg text-slate-800 mb-4">Cost Analysis</h3>
                                <div className="text-sm text-slate-700 mb-4">{selectedRouteOptimization.reason || 'No analysis available'}</div>
                                
                                {/* Risk Factors */}
                                {selectedRouteOptimization.riskFactors && selectedRouteOptimization.riskFactors.length > 0 && (
                                    <div className="mb-4">
                                        <div className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Risk Factors Contributing to High Cost</div>
                                        <div className="space-y-2">
                                            {selectedRouteOptimization.riskFactors.map((factor, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs">
                                                    <span className="text-slate-700 capitalize">{factor.factor.replace(/_/g, ' ')}</span>
                                                    <span className="font-semibold text-slate-800">{factor.contribution_percentage}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Route Analysis */}
                                {selectedRouteOptimization.routeAnalysis?.explanation && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                        <div className="text-xs font-semibold text-slate-600 mb-2">Route Analysis</div>
                                        <div className="text-sm text-slate-700 mb-2">{selectedRouteOptimization.routeAnalysis.explanation.summary}</div>
                                        {selectedRouteOptimization.routeAnalysis.explanation.detailed_breakdown && (
                                            <ul className="space-y-1 text-xs text-slate-600">
                                                {selectedRouteOptimization.routeAnalysis.explanation.detailed_breakdown.slice(0, 3).map((detail, idx) => (
                                                    <li key={idx}>• {detail}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {/* Delay Prediction */}
                                {selectedRouteOptimization.delayPrediction && selectedRouteOptimization.delayPrediction.predicted_delay_minutes !== undefined && (
                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                        <div className="text-xs font-semibold text-slate-600 mb-2">Delay Prediction</div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-slate-700">
                                                Predicted Delay: <strong>{selectedRouteOptimization.delayPrediction.predicted_delay_minutes} min</strong>
                                            </span>
                                            <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                                                selectedRouteOptimization.delayPrediction.delay_risk_band === 'high' ? 'bg-red-100 text-red-700' :
                                                selectedRouteOptimization.delayPrediction.delay_risk_band === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                                {selectedRouteOptimization.delayPrediction.delay_risk_band} Risk
                                            </span>
                                        </div>
                                        {selectedRouteOptimization.delayPrediction.explanation && (
                                            <div className="text-xs text-slate-600 mt-2">{selectedRouteOptimization.delayPrediction.explanation}</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Recommendations */}
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h3 className="font-bold text-lg text-blue-800 mb-3">Optimization Recommendations</h3>
                                <div className="text-sm text-slate-800 mb-4">{selectedRouteOptimization.suggestion || 'No recommendations available'}</div>
                                
                                {selectedRouteOptimization.routeAnalysis?.recommendations && selectedRouteOptimization.routeAnalysis.recommendations.length > 0 && (
                                    <div className="space-y-2">
                                        {selectedRouteOptimization.routeAnalysis.recommendations.map((rec, idx) => (
                                            <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded border border-blue-200 text-sm">
                                                <Zap size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                                                <span className="text-slate-700">{rec}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Action Items */}
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Recommended Actions</div>
                                    <ul className="space-y-2 text-sm text-slate-700">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                            <span>Review current route and identify alternative paths with lower fuel consumption</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                            <span>Consider route optimization tools to reduce distance and fuel cost</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                            <span>Evaluate if current transportation mode is optimal for this distance</span>
                                        </li>
                                        {selectedRouteOptimization.savingsPotential > 50 && (
                                            <li className="flex items-start gap-2">
                                                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                                <span>Potential savings of ₹{selectedRouteOptimization.savingsPotential.toFixed(0)} justifies route review and optimization</span>
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        // Navigate to route suggestions with this shipment
                                        if (selectedRouteOptimization.shipment?.id) {
                                            window.location.hash = `/operator/intelligence/routes?shipment=${selectedRouteOptimization.shipment.id}`;
                                        } else {
                                            alert('Shipment ID not available');
                                        }
                                        setSelectedRouteOptimization(null);
                                    }}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-medium transition"
                                    disabled={!selectedRouteOptimization.shipment?.id}
                                >
                                    View Alternative Routes
                                </button>
                                <button
                                    onClick={() => setSelectedRouteOptimization(null)}
                                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-3 rounded-lg text-sm font-medium transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default CostOptimization;
