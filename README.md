# Adventure Summariser - ServiceNow Application

A ServiceNow application that generates AI-powered summaries of Dungeons & Dragons adventures and posts them to Discord.

## Features

- **Adventure Input Form**: Capture D&D adventure details including session info, characters, plot points, and outcomes
- **AI Summary Generation**: Uses LLM APIs (OpenAI, Anthropic, etc.) to create engaging adventure summaries
- **Discord Integration**: Automatically posts summaries to Discord channels via webhooks
- **Workflow Automation**: Streamlined process from input to Discord posting

## Application Structure

### Tables
- `x_adventure_summariser_adventure` - Main adventure records
- `x_adventure_summariser_character` - Character information
- `x_adventure_summariser_session` - Individual session details
- `x_adventure_summariser_summary` - Generated AI summaries

### Scripts
- `AdventureSummariserUtils` - Utility functions for AI and Discord integration
- `AdventureSummariserWorkflow` - Main workflow orchestration

### UI Components
- Adventure input form
- Summary display pages
- Configuration screens

## Setup Instructions

1. Import the application into your ServiceNow instance
2. Configure AI API credentials in system properties
3. Set up Discord webhook URLs
4. Configure workflow automation
5. Test with sample adventure data

## API Integrations

- **OpenAI GPT**: Primary AI summary generation
- **Anthropic Claude**: Alternative AI provider
- **Discord Webhooks**: Automated posting to Discord channels

## Development

This application is designed to be modular and extensible, allowing for easy addition of new AI providers or output channels.
