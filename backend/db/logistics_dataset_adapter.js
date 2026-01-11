/**
 * Logistics AI Enriched Dataset Adapter
 * 
 * This module provides a safe ingestion layer for the logistics_ai_enriched_dataset.csv
 * without modifying existing functionality or breaking existing APIs.
 * 
 * USAGE:
 *   const adapter = require('./logistics_dataset_adapter');
 *   const { shipments, driverSkills, feedbacks } = await adapter.loadDataset('path/to/dataset.csv');
 */

const fs = require('fs');
const path = require('path');
const { 
    LogisticsDatasetRow, 
    mapToShipment, 
    mapToDriverSkills, 
    mapToFeedback,
    mapVehicleType 
} = require('./logistics_dataset_schema');

/**
 * Parse CSV file and return structured data
 * 
 * @param {string} csvPath - Path to CSV file
 * @param {Object} options - Ingestion options
 * @param {number} options.limit - Maximum number of rows to process (for testing)
 * @param {boolean} options.validate - Whether to validate rows (default: true)
 * @param {Function} options.riderIdMapper - Custom function to map rider_id to driver_id
 * @param {number} options.defaultCustomerId - Default customer ID for unmapped shipments
 * @returns {Promise<Object>} Parsed data structure
 */
async function loadDataset(csvPath, options = {}) {
    const {
        limit = null,
        validate = true,
        riderIdMapper = null,
        defaultCustomerId = null,
        skipErrors = false
    } = options;
    
    // Default rider ID mapper: Extract numeric ID from format like "R4110" -> 4110
    const defaultRiderIdMapper = (riderId) => {
        if (!riderId) return null;
        const match = riderId.toString().match(/\d+/);
        return match ? parseInt(match[0]) : null;
    };
    
    const mapper = riderIdMapper || defaultRiderIdMapper;
    
    try {
        // Read CSV file
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }
        
        // Parse header
        const header = lines[0].split(',').map(h => h.trim());
        const headerMap = {};
        header.forEach((col, idx) => {
            headerMap[col] = idx;
        });
        
        // Validate required columns
        const requiredColumns = [
            'order_id', 'rider_id', 'pickup_lat', 'pickup_lon', 
            'drop_lat', 'drop_lon', 'city', 'country'
        ];
        
        const missingColumns = requiredColumns.filter(col => !headerMap.hasOwnProperty(col));
        if (missingColumns.length > 0) {
            throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
        }
        
        // Parse data rows
        const shipments = [];
        const driverSkillsMap = new Map(); // Use Map to aggregate skills by driver_id
        const feedbacks = [];
        const errors = [];
        
        const dataLines = limit ? lines.slice(1, limit + 1) : lines.slice(1);
        
        dataLines.forEach((line, lineIndex) => {
            if (!line.trim()) return; // Skip empty lines
            
            try {
                // Parse CSV row (handling quoted values)
                const rowData = parseCSVLine(line);
                const row = {};
                
                // Map CSV columns to row object
                Object.keys(headerMap).forEach(column => {
                    const colIndex = headerMap[column];
                    row[column] = rowData[colIndex] || null;
                });
                
                // Create dataset row object
                const datasetRow = new LogisticsDatasetRow(row);
                
                // Validate row if enabled
                if (validate) {
                    const validation = datasetRow.validate();
                    if (!validation.valid) {
                        if (skipErrors) {
                            errors.push({
                                row: lineIndex + 2, // +2 for header and 1-indexed
                                order_id: datasetRow.order_id,
                                errors: validation.errors
                            });
                            return; // Skip invalid rows
                        } else {
                            throw new Error(`Row ${lineIndex + 2} validation failed: ${validation.errors.join(', ')}`);
                        }
                    }
                }
                
                // Map to shipment (existing structure)
                const shipment = mapToShipment(datasetRow, {
                    customer_id: defaultCustomerId,
                    riderIdMapper: mapper
                });
                shipments.push(shipment);
                
                // Map to driver skills (enhanced structure)
                const driverSkills = mapToDriverSkills(datasetRow, mapper);
                if (driverSkills) {
                    const driverId = driverSkills.driver_id;
                    
                    // Aggregate skills: if driver appears multiple times, average the skills
                    if (driverSkillsMap.has(driverId)) {
                        const existing = driverSkillsMap.get(driverId);
                        // Average skill dimensions
                        const existingSkills = existing._skill_dimensions;
                        const newSkills = driverSkills._skill_dimensions;
                        
                        existing._skill_dimensions = {
                            fragile_handling: (existingSkills.fragile_handling + newSkills.fragile_handling) / 2,
                            urgency_handling: (existingSkills.urgency_handling + newSkills.urgency_handling) / 2,
                            night_driving: (existingSkills.night_driving + newSkills.night_driving) / 2,
                            weather_resilience: (existingSkills.weather_resilience + newSkills.weather_resilience) / 2
                        };
                        
                        // Recalculate skill_index
                        const skills = existing._skill_dimensions;
                        existing.skill_index = (
                            skills.fragile_handling * 0.25 +
                            skills.urgency_handling * 0.25 +
                            skills.night_driving * 0.25 +
                            skills.weather_resilience * 0.25
                        ) * 10;
                        
                        // Update level
                        if (existing.skill_index >= 9) existing.level = 'ELITE';
                        else if (existing.skill_index >= 7.5) existing.level = 'Advanced';
                        else if (existing.skill_index >= 6) existing.level = 'Intermediate';
                        else existing.level = 'Standard';
                    } else {
                        driverSkillsMap.set(driverId, driverSkills);
                    }
                }
                
                // Map to feedback (existing structure)
                // Note: shipment ID will be assigned later when shipments are inserted into DB
                const feedback = mapToFeedback(datasetRow, null, mapper); // shipmentId will be set during DB insertion
                if (feedback) {
                    feedbacks.push({
                        ...feedback,
                        _original_order_id: datasetRow.order_id // Track original order for mapping
                    });
                }
                
            } catch (error) {
                if (skipErrors) {
                    errors.push({
                        row: lineIndex + 2,
                        error: error.message
                    });
                } else {
                    throw new Error(`Error parsing row ${lineIndex + 2}: ${error.message}`);
                }
            }
        });
        
        return {
            shipments: shipments,
            driverSkills: Array.from(driverSkillsMap.values()),
            feedbacks: feedbacks,
            errors: errors,
            stats: {
                totalRows: dataLines.length,
                validRows: shipments.length,
                errorRows: errors.length,
                uniqueDrivers: driverSkillsMap.size,
                feedbacksWithRating: feedbacks.filter(f => f.rating > 0).length
            }
        };
        
    } catch (error) {
        throw new Error(`Failed to load dataset: ${error.message}`);
    }
}

/**
 * Simple CSV line parser (handles basic quoted values)
 * For production, consider using a proper CSV parser library like 'csv-parser' or 'papaparse'
 * 
 * @param {string} line - CSV line string
 * @returns {string[]} Array of column values
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current.trim()); // Push last value
    
    return values;
}

/**
 * Get dataset statistics without loading all data
 * Useful for validation before full ingestion
 * 
 * @param {string} csvPath - Path to CSV file
 * @returns {Promise<Object>} Dataset statistics
 */
async function getDatasetStats(csvPath) {
    try {
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            return { totalRows: 0, columns: [] };
        }
        
        const header = lines[0].split(',').map(h => h.trim());
        const totalRows = lines.length - 1;
        
        // Sample first few data rows to check structure
        const sampleRows = Math.min(5, totalRows);
        const samples = [];
        
        for (let i = 1; i <= sampleRows; i++) {
            if (lines[i]) {
                const row = parseCSVLine(lines[i]);
                const rowObj = {};
                header.forEach((col, idx) => {
                    rowObj[col] = row[idx] || null;
                });
                samples.push(rowObj);
            }
        }
        
        return {
            totalRows: totalRows,
            columns: header,
            sampleRows: samples,
            fileSize: fs.statSync(csvPath).size
        };
    } catch (error) {
        throw new Error(`Failed to get dataset stats: ${error.message}`);
    }
}

/**
 * Validate dataset file structure
 * 
 * @param {string} csvPath - Path to CSV file
 * @returns {Promise<Object>} Validation result
 */
async function validateDataset(csvPath) {
    try {
        const stats = await getDatasetStats(csvPath);
        const issues = [];
        const warnings = [];
        
        // Check required columns
        const requiredColumns = [
            'order_id', 'rider_id', 'pickup_lat', 'pickup_lon',
            'drop_lat', 'drop_lon', 'city', 'country'
        ];
        
        const missingColumns = requiredColumns.filter(col => !stats.columns.includes(col));
        if (missingColumns.length > 0) {
            issues.push(`Missing required columns: ${missingColumns.join(', ')}`);
        }
        
        // Validate sample rows
        if (stats.sampleRows && stats.sampleRows.length > 0) {
            stats.sampleRows.forEach((row, idx) => {
                try {
                    const datasetRow = new LogisticsDatasetRow(row);
                    const validation = datasetRow.validate();
                    if (!validation.valid) {
                        warnings.push(`Sample row ${idx + 1} has validation issues: ${validation.errors.join(', ')}`);
                    }
                } catch (error) {
                    warnings.push(`Sample row ${idx + 1} parsing error: ${error.message}`);
                }
            });
        }
        
        return {
            valid: issues.length === 0,
            issues: issues,
            warnings: warnings,
            stats: stats
        };
    } catch (error) {
        return {
            valid: false,
            issues: [error.message],
            warnings: [],
            stats: null
        };
    }
}

module.exports = {
    loadDataset,
    getDatasetStats,
    validateDataset,
    parseCSVLine
};
