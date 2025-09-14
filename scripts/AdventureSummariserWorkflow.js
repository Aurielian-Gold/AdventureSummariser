/**
 * Adventure Summariser Workflow Script
 * Handles the complete workflow from adventure input to Discord posting
 */

var AdventureSummariserWorkflow = Class.create();
AdventureSummariserWorkflow.prototype = {
    initialize: function() {
        this.utils = new AdventureSummariserUtils();
    },

    /**
     * Main workflow function - called when adventure is created/updated
     * @param {GlideRecord} current - Current adventure record
     * @param {GlideRecord} previous - Previous adventure record (for updates)
     */
    onAdventureChange: function(current, previous) {
        try {
            // Only process if this is a new record or if AI summary is empty
            if (previous && current.getValue('ai_summary')) {
                gs.info('AdventureSummariserWorkflow: Adventure already has AI summary, skipping');
                return;
            }

            // Check if we have the minimum required fields
            if (!this.validateAdventure(current)) {
                gs.warn('AdventureSummariserWorkflow: Adventure validation failed');
                return;
            }

            // Process the adventure
            var success = this.utils.processAdventure(current.getUniqueValue());
            
            if (success) {
                gs.info('AdventureSummariserWorkflow: Successfully processed adventure: ' + current.getUniqueValue());
            } else {
                gs.error('AdventureSummariserWorkflow: Failed to process adventure: ' + current.getUniqueValue());
            }

        } catch (e) {
            gs.error('AdventureSummariserWorkflow: Error in workflow: ' + e.message);
        }
    },

    /**
     * Validate adventure record has required fields
     * @param {GlideRecord} adventure - Adventure record to validate
     * @returns {boolean} Validation result
     */
    validateAdventure: function(adventure) {
        if (!adventure.getValue('title')) {
            gs.warn('AdventureSummariserWorkflow: Adventure title is required');
            return false;
        }

        if (!adventure.getValue('session_date')) {
            gs.warn('AdventureSummariserWorkflow: Session date is required');
            return false;
        }

        // Check if we have either description or session notes
        if (!adventure.getValue('description') && !adventure.getValue('session_notes')) {
            gs.warn('AdventureSummariserWorkflow: Either description or session notes is required');
            return false;
        }

        return true;
    },

    /**
     * Manual trigger for processing an adventure
     * @param {string} adventureId - Sys ID of the adventure
     * @returns {boolean} Success status
     */
    processAdventureManually: function(adventureId) {
        try {
            var adventure = new GlideRecord('x_adventure_summariser_adventure');
            if (!adventure.get(adventureId)) {
                gs.error('AdventureSummariserWorkflow: Adventure not found: ' + adventureId);
                return false;
            }

            return this.utils.processAdventure(adventureId);

        } catch (e) {
            gs.error('AdventureSummariserWorkflow: Error in manual processing: ' + e.message);
            return false;
        }
    },

    /**
     * Batch process multiple adventures
     * @param {Array} adventureIds - Array of adventure Sys IDs
     * @returns {Object} Processing results
     */
    batchProcessAdventures: function(adventureIds) {
        var results = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: []
        };

        for (var i = 0; i < adventureIds.length; i++) {
            try {
                results.processed++;
                var success = this.processAdventureManually(adventureIds[i]);
                
                if (success) {
                    results.successful++;
                } else {
                    results.failed++;
                    results.errors.push('Failed to process adventure: ' + adventureIds[i]);
                }

            } catch (e) {
                results.failed++;
                results.errors.push('Error processing adventure ' + adventureIds[i] + ': ' + e.message);
            }
        }

        gs.info('AdventureSummariserWorkflow: Batch processing complete. Processed: ' + results.processed + 
                ', Successful: ' + results.successful + ', Failed: ' + results.failed);

        return results;
    },

    /**
     * Get processing statistics
     * @returns {Object} Processing statistics
     */
    getProcessingStats: function() {
        var stats = {
            totalAdventures: 0,
            withAISummary: 0,
            postedToDiscord: 0,
            pendingProcessing: 0
        };

        // Total adventures
        var adventureGr = new GlideRecord('x_adventure_summariser_adventure');
        stats.totalAdventures = adventureGr.getRowCount();

        // Adventures with AI summary
        adventureGr = new GlideRecord('x_adventure_summariser_adventure');
        adventureGr.addQuery('ai_summary', '!=', '');
        stats.withAISummary = adventureGr.getRowCount();

        // Adventures posted to Discord
        adventureGr = new GlideRecord('x_adventure_summariser_adventure');
        adventureGr.addQuery('discord_posted', 'true');
        stats.postedToDiscord = adventureGr.getRowCount();

        // Pending processing
        stats.pendingProcessing = stats.totalAdventures - stats.withAISummary;

        return stats;
    },

    /**
     * Clean up old processing data
     * @param {number} daysOld - Number of days old to clean up
     * @returns {number} Number of records cleaned up
     */
    cleanupOldData: function(daysOld) {
        var cleanedUp = 0;
        var cutoffDate = new GlideDateTime();
        cutoffDate.addDays(-daysOld);

        try {
            // Clean up old adventures without AI summaries
            var adventureGr = new GlideRecord('x_adventure_summariser_adventure');
            adventureGr.addQuery('sys_created_on', '<=', cutoffDate);
            adventureGr.addQuery('ai_summary', '');
            adventureGr.addQuery('discord_posted', 'false');
            adventureGr.query();

            while (adventureGr.next()) {
                adventureGr.deleteRecord();
                cleanedUp++;
            }

            gs.info('AdventureSummariserWorkflow: Cleaned up ' + cleanedUp + ' old records');

        } catch (e) {
            gs.error('AdventureSummariserWorkflow: Error during cleanup: ' + e.message);
        }

        return cleanedUp;
    },

    type: 'AdventureSummariserWorkflow'
};
