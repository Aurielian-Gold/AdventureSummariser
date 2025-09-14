/**
 * Adventure Summariser Utility Functions
 * Handles AI API integration and Discord webhook posting
 */

var AdventureSummariserUtils = Class.create();
AdventureSummariserUtils.prototype = {
    initialize: function() {
        this.aiProvider = gs.getProperty('adventure_summariser.ai_provider', 'openai');
        this.openaiApiKey = gs.getProperty('adventure_summariser.openai_api_key');
        this.anthropicApiKey = gs.getProperty('adventure_summariser.anthropic_api_key');
        this.discordWebhookUrl = gs.getProperty('adventure_summariser.discord_webhook_url');
    },

    /**
     * Generate AI summary for an adventure
     * @param {string} adventureId - Sys ID of the adventure record
     * @returns {string} Generated AI summary
     */
    generateAISummary: function(adventureId) {
        try {
            var adventure = new GlideRecord('x_adventure_summariser_adventure');
            if (!adventure.get(adventureId)) {
                gs.error('AdventureSummariserUtils: Adventure not found with ID: ' + adventureId);
                return null;
            }

            // Get characters for this adventure
            var characters = this.getAdventureCharacters(adventureId);
            
            // Build prompt for AI
            var prompt = this.buildAIPrompt(adventure, characters);
            
            // Call AI API based on configured provider
            var summary = '';
            switch (this.aiProvider) {
                case 'openai':
                    summary = this.callOpenAI(prompt);
                    break;
                case 'anthropic':
                    summary = this.callAnthropic(prompt);
                    break;
                default:
                    gs.error('AdventureSummariserUtils: Unknown AI provider: ' + this.aiProvider);
                    return null;
            }

            // Update adventure record with AI summary
            adventure.setValue('ai_summary', summary);
            adventure.update();

            return summary;

        } catch (e) {
            gs.error('AdventureSummariserUtils: Error generating AI summary: ' + e.message);
            return null;
        }
    },

    /**
     * Get characters for an adventure
     * @param {string} adventureId - Sys ID of the adventure
     * @returns {Array} Array of character objects
     */
    getAdventureCharacters: function(adventureId) {
        var characters = [];
        var characterGr = new GlideRecord('x_adventure_summariser_character');
        characterGr.addQuery('adventure', adventureId);
        characterGr.query();
        
        while (characterGr.next()) {
            characters.push({
                name: characterGr.getValue('character_name'),
                player: characterGr.getValue('player_name'),
                class: characterGr.getValue('character_class'),
                level: characterGr.getValue('character_level')
            });
        }
        
        return characters;
    },

    /**
     * Build AI prompt for summary generation
     * @param {GlideRecord} adventure - Adventure record
     * @param {Array} characters - Array of character objects
     * @returns {string} Formatted prompt for AI
     */
    buildAIPrompt: function(adventure, characters) {
        var prompt = "Please create an engaging summary of this Dungeons & Dragons adventure session:\n\n";
        
        prompt += "**Adventure Title:** " + adventure.getValue('title') + "\n";
        prompt += "**Session Date:** " + adventure.getValue('session_date') + "\n";
        prompt += "**Dungeon Master:** " + adventure.getValue('dungeon_master') + "\n";
        prompt += "**Adventure Level:** " + adventure.getValue('adventure_level') + "\n\n";
        
        if (adventure.getValue('description')) {
            prompt += "**Adventure Description:**\n" + adventure.getValue('description') + "\n\n";
        }
        
        if (characters.length > 0) {
            prompt += "**Characters:**\n";
            for (var i = 0; i < characters.length; i++) {
                var char = characters[i];
                prompt += "- " + char.name;
                if (char.player) prompt += " (played by " + char.player + ")";
                if (char.class) prompt += " - " + char.class;
                if (char.level) prompt += " Level " + char.level;
                prompt += "\n";
            }
            prompt += "\n";
        }
        
        if (adventure.getValue('session_notes')) {
            prompt += "**Session Notes:**\n" + adventure.getValue('session_notes') + "\n\n";
        }
        
        prompt += "Please create a compelling summary that captures the key events, character moments, and highlights of this adventure session. Make it engaging and suitable for sharing with the gaming group. Keep it between 200-400 words.";
        
        return prompt;
    },

    /**
     * Call OpenAI API for summary generation
     * @param {string} prompt - Prompt to send to OpenAI
     * @returns {string} Generated summary
     */
    callOpenAI: function(prompt) {
        if (!this.openaiApiKey) {
            gs.error('AdventureSummariserUtils: OpenAI API key not configured');
            return null;
        }

        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint('https://api.openai.com/v1/chat/completions');
        restMessage.setHttpMethod('POST');
        restMessage.setRequestHeader('Authorization', 'Bearer ' + this.openaiApiKey);
        restMessage.setRequestHeader('Content-Type', 'application/json');

        var requestBody = {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a creative writer who specializes in creating engaging summaries of Dungeons & Dragons adventures. Write in an exciting, narrative style that captures the drama and excitement of the game.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.7
        };

        restMessage.setRequestBody(JSON.stringify(requestBody));

        var response = restMessage.execute();
        var responseBody = JSON.parse(response.getBody());

        if (response.getStatusCode() === 200) {
            return responseBody.choices[0].message.content;
        } else {
            gs.error('AdventureSummariserUtils: OpenAI API error: ' + response.getStatusCode() + ' - ' + response.getBody());
            return null;
        }
    },

    /**
     * Call Anthropic API for summary generation
     * @param {string} prompt - Prompt to send to Anthropic
     * @returns {string} Generated summary
     */
    callAnthropic: function(prompt) {
        if (!this.anthropicApiKey) {
            gs.error('AdventureSummariserUtils: Anthropic API key not configured');
            return null;
        }

        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint('https://api.anthropic.com/v1/messages');
        restMessage.setHttpMethod('POST');
        restMessage.setRequestHeader('x-api-key', this.anthropicApiKey);
        restMessage.setRequestHeader('Content-Type', 'application/json');
        restMessage.setRequestHeader('anthropic-version', '2023-06-01');

        var requestBody = {
            model: 'claude-3-sonnet-20240229',
            max_tokens: 500,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        };

        restMessage.setRequestBody(JSON.stringify(requestBody));

        var response = restMessage.execute();
        var responseBody = JSON.parse(response.getBody());

        if (response.getStatusCode() === 200) {
            return responseBody.content[0].text;
        } else {
            gs.error('AdventureSummariserUtils: Anthropic API error: ' + response.getStatusCode() + ' - ' + response.getBody());
            return null;
        }
    },

    /**
     * Post summary to Discord
     * @param {string} adventureId - Sys ID of the adventure
     * @returns {boolean} Success status
     */
    postToDiscord: function(adventureId) {
        try {
            if (!this.discordWebhookUrl) {
                gs.error('AdventureSummariserUtils: Discord webhook URL not configured');
                return false;
            }

            var adventure = new GlideRecord('x_adventure_summariser_adventure');
            if (!adventure.get(adventureId)) {
                gs.error('AdventureSummariserUtils: Adventure not found with ID: ' + adventureId);
                return false;
            }

            var summary = adventure.getValue('ai_summary');
            if (!summary) {
                gs.error('AdventureSummariserUtils: No AI summary found for adventure: ' + adventureId);
                return false;
            }

            var restMessage = new sn_ws.RESTMessageV2();
            restMessage.setEndpoint(this.discordWebhookUrl);
            restMessage.setHttpMethod('POST');
            restMessage.setRequestHeader('Content-Type', 'application/json');

            var discordMessage = {
                embeds: [{
                    title: "🎲 " + adventure.getValue('title'),
                    description: summary,
                    color: 0x9932CC, // Purple color
                    fields: [
                        {
                            name: "📅 Session Date",
                            value: adventure.getValue('session_date'),
                            inline: true
                        },
                        {
                            name: "🎭 Dungeon Master",
                            value: adventure.getValue('dungeon_master') || "Unknown",
                            inline: true
                        },
                        {
                            name: "⚔️ Adventure Level",
                            value: adventure.getValue('adventure_level'),
                            inline: true
                        }
                    ],
                    footer: {
                        text: "Generated by Adventure Summariser"
                    },
                    timestamp: new GlideDateTime().getISOString()
                }]
            };

            restMessage.setRequestBody(JSON.stringify(discordMessage));

            var response = restMessage.execute();

            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                // Mark as posted to Discord
                adventure.setValue('discord_posted', true);
                adventure.update();
                return true;
            } else {
                gs.error('AdventureSummariserUtils: Discord webhook error: ' + response.getStatusCode() + ' - ' + response.getBody());
                return false;
            }

        } catch (e) {
            gs.error('AdventureSummariserUtils: Error posting to Discord: ' + e.message);
            return false;
        }
    },

    /**
     * Complete workflow: Generate summary and post to Discord
     * @param {string} adventureId - Sys ID of the adventure
     * @returns {boolean} Success status
     */
    processAdventure: function(adventureId) {
        try {
            // Generate AI summary
            var summary = this.generateAISummary(adventureId);
            if (!summary) {
                gs.error('AdventureSummariserUtils: Failed to generate AI summary');
                return false;
            }

            // Post to Discord
            var posted = this.postToDiscord(adventureId);
            if (!posted) {
                gs.error('AdventureSummariserUtils: Failed to post to Discord');
                return false;
            }

            gs.info('AdventureSummariserUtils: Successfully processed adventure: ' + adventureId);
            return true;

        } catch (e) {
            gs.error('AdventureSummariserUtils: Error processing adventure: ' + e.message);
            return false;
        }
    },

    type: 'AdventureSummariserUtils'
};
